import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  getAuthenticatedAccount,
  loginAccount,
  registerAccount,
  revokeSessionToken,
  updateAccountFamilyCircle,
  type StoredAccount,
} from './server/authStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const PRIMARY_ANALYZE_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_ANALYZE_MODEL = 'gemini-3.1-flash-lite';
const TRANSIENT_RETRY_DELAYS_MS = [2000, 4000];
let activeAnalyzeModel = PRIMARY_ANALYZE_MODEL;

const ALLOWED_CATEGORIES = new Set([
  'Urgency',
  'Secrecy',
  'Payment Request',
  'Impersonation',
]);

type DemoClipSpec = {
  model: string;
  text: string;
};

const DEMO_CLIP_SPECS: Record<string, DemoClipSpec> = {
  'scam-english': {
    model: 'gemini-3.8-flash-lite-tts',
    text: "Say urgently in a stressed voice: Dad, I've been in a car accident, my phone is dying, please don't tell Mom, send 50,000 rupees to this UPI ID right now.",
  },
  'scam-telugu-mixed': {
    model: 'gemini-3.8-flash-lite-tts',
    text: 'Say urgently: Nanna urgent ga 30,000 pampu, hospital lo unnanu, evariki cheppaku please.',
  },
  'safe-checkin': {
    model: 'gemini-3.8-flash-lite-tts',
    text: "Say warmly and calmly: Hey, just checking if you reached home safely. Let's have dinner at 8 PM.",
  },
};

const demoAudioCache = new Map<string, Buffer>();

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const account = getAuthenticatedAccount(token);
  if (!account) {
    res.status(401).json({
      error: 'Please sign in to access your saved account and voice verification.',
    });
    return;
  }
  res.locals.account = account;
  next();
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please set it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeMimeType(rawMimeType: string): string {
  const base = rawMimeType.split(';')[0].trim().toLowerCase();
  if (!base) {
    return 'audio/webm';
  }
  if (base === 'audio/m4a' || base === 'audio/x-m4a') {
    return 'audio/mp4';
  }
  if (base === 'audio/mp3') {
    return 'audio/mpeg';
  }
  if (base === 'audio/x-wav' || base === 'audio/wave') {
    return 'audio/wav';
  }
  if (base === 'video/webm') {
    return 'audio/webm';
  }
  if (base.startsWith('audio/')) {
    return base;
  }
  return 'audio/wav';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseReadableErrorMessage(rawMessage: string): string {
  const trimmed = rawMessage.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; code?: number; status?: string };
      message?: string;
    };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
    if (parsed?.message) {
      return parsed.message;
    }
  } catch {
    // Check if an embedded JSON object exists after a prefix
    const jsonStart = trimmed.indexOf('{');
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
          error?: { message?: string };
        };
        if (parsed?.error?.message) {
          return parsed.error.message;
        }
      } catch {
        // Not valid JSON
      }
    }
  }
  return trimmed;
}

function getGeminiErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const numeric = Number((err as { status?: unknown }).status);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted')) {
    return 429;
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded')
  ) {
    return 503;
  }
  if (lower.includes('404') || lower.includes('not_found')) {
    return 404;
  }
  if (
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid')
  ) {
    return 403;
  }
  if (lower.includes('400') || lower.includes('invalid_argument')) {
    return 400;
  }
  return undefined;
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : 'Unexpected server error during audio analysis.';
  const readable = parseReadableErrorMessage(rawMessage);
  const lower = readable.toLowerCase();
  const detectedStatus = getGeminiErrorStatus(err);

  if (
    detectedStatus === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied')
  ) {
    return {
      status: 403,
      message:
        'Gemini API authentication failed. Please verify your API key in Settings > Secrets.',
    };
  }
  if (
    detectedStatus === 429 ||
    detectedStatus === 503 ||
    lower.includes('resource_exhausted') ||
    lower.includes('unavailable')
  ) {
    return {
      status: detectedStatus === 503 ? 503 : 429,
      message: 'High traffic — please wait 15 seconds and try again.',
    };
  }
  if (detectedStatus === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      message: readable || rawMessage,
    };
  }
  if (detectedStatus === 404 || lower.includes('not_found')) {
    return {
      status: 502,
      message: readable || rawMessage,
    };
  }
  if (lower.includes('gemini_api_key is not configured')) {
    return {
      status: 500,
      message: readable,
    };
  }
  return {
    status: detectedStatus && detectedStatus >= 400 ? detectedStatus : 500,
    message: readable || rawMessage,
  };
}

async function startServer(): Promise<void> {
  const app = express();

  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Authentication endpoints
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const result = registerAccount(
      req.body?.username,
      req.body?.password,
      req.body?.safeWord
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      token: result.token,
      username: result.account.username,
      familyCircle: result.account.familyCircle,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const result = loginAccount(req.body?.username, req.body?.password);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      token: result.token,
      username: result.account.username,
      familyCircle: result.account.familyCircle,
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    revokeSessionToken(token);
    res.json({ ok: true });
  });

  // Saved account Family Circle persistence
  app.put('/api/account/family-circle', requireAuth, (req: Request, res: Response) => {
    const account = res.locals.account as StoredAccount;
    const updated = updateAccountFamilyCircle(account.usernameLower, req.body);
    if (!updated) {
      res.status(400).json({ error: 'Invalid Family Circle configuration.' });
      return;
    }
    res.json({ familyCircle: updated });
  });

  app.get('/api/demo-clip/:id', requireAuth, async (req: Request, res: Response) => {
    const clipId = req.params.id;
    const spec = DEMO_CLIP_SPECS[clipId];
    if (!spec) {
      res.status(404).json({ error: 'Unknown demo clip scenario.' });
      return;
    }

    try {
      let wavBuffer = demoAudioCache.get(clipId);
      if (!wavBuffer) {
        const ai = getAiClient();
        const ttsResponse = await ai.models.generateContent({
          model: spec.model,
          contents: [
            {
              role: 'user',
              parts: [{ text: spec.text }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
          },
        });

        const base64Audio =
          ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          res.status(502).json({
            error: 'Demo audio synthesis returned an empty audio payload.',
          });
          return;
        }

        wavBuffer = Buffer.from(base64Audio, 'base64');
        demoAudioCache.set(clipId, wavBuffer);
      }

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', String(wavBuffer.length));
      res.setHeader('Cache-Control', 'no-store');
      res.send(wavBuffer);
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/analyze', requireAuth, async (req: Request, res: Response) => {
    let audioBase64: string | undefined = req.body?.audioBase64;
    const rawMimeType: unknown = req.body?.mimeType;

    if (typeof audioBase64 !== 'string' || audioBase64.trim().length === 0) {
      res.status(400).json({ error: 'Missing audio data for analysis.' });
      return;
    }

    if (audioBase64.includes(',')) {
      audioBase64 = audioBase64.split(',')[1] ?? '';
    }

    const estimatedBytes = Math.ceil((audioBase64.length * 3) / 4);
    if (estimatedBytes > MAX_AUDIO_BYTES) {
      res.status(413).json({
        error: 'Audio clip exceeds the 10 MB limit.',
      });
      return;
    }

    const cleanMimeType =
      typeof rawMimeType === 'string'
        ? normalizeMimeType(rawMimeType)
        : 'audio/wav';

    try {
      const ai = getAiClient();

      const systemInstruction = `You are SafeVoice Guard, a defensive voice-scam and deepfake audio analyzer helping families detect voice-cloning fraud and social engineering calls.

Return strictly valid JSON matching the schema. Keep flaggedPhrases exact substrings of transcript whenever possible. Use plain, jargon-free language suitable for older adults.

Perform TWO independent evaluations on this audio clip in a single pass:

1. AUDIO AUTHENTICITY & ACOUSTIC ARTIFACT CHECK (Anti-Spoofing Signal):
- Listen closely to vocal prosody, micro-tremors, pitch continuity, spectral flatness, breathing cadence, syllable transitions, and background noise floor consistency.
- Distinguish clearly between genuine synthetic/TTS/voice-cloning artifacts (unnatural metallic smoothness, robotic micro-cadence, phase artifacts, missing natural breath intakes, sudden noise-floor gating) vs ordinary telephone/VoIP narrowband compression.
- Estimate syntheticProbability from 0.0 to 1.0:
  - < 0.35: Natural human vocal acoustics with organic breath, varied micro-prosody, and consistent room ambiance.
  - 0.35 to 0.65: Uncertain (e.g., degraded phone compression, narrowband codec distortion, or ambiguous prosody).
  - > 0.65: Strong synthetic/TTS/cloned-voice acoustic artifacts.
- Provide 2 to 3 concise, plain-language acousticObservations describing what you heard.

2. MULTILINGUAL SPEECH-TO-TEXT & SCAM-LANGUAGE DETECTOR (English, Hindi, Telugu, or Code-Mixed):
- Transcribe ONLY the exact words actually spoken in the audio into "transcript", preserving the spoken language(s) (including Romanized or native Hindi/Telugu/English code-mixing accurately as heard).
- CRITICAL: If the audio contains only silence, music, tones, or background noise with no intelligible spoken words, return an empty string "" for "transcript", empty array [] for "flaggedPhrases", and 0.0 for "scamLanguageScore". Do NOT invent or guess speech.
- If the speech is non-English or code-mixed, provide a clear English translation in "englishTranslation". If already pure English or empty, return an empty string "" for "englishTranslation".
- Detect manipulative or high-risk scam patterns actually spoken in the audio and extract the EXACT matching substrings from "transcript" into "flaggedPhrases".
- Each flagged phrase MUST use one of these exact 4 categories according to these strict definitions and examples:
  - "Impersonation": ONLY words or phrases where the speaker claims a familial, official, or trusted identity/relationship (e.g., "Mom,", "Dad,", "Nanna,", "Amma,", "It's me", "It's your son", "This is your manager", "Calling from bank security"). NEVER tag "I have been in an accident" or "hospital" as "Impersonation".
  - "Urgency": Phrases creating panic, crisis, or immediate time pressure (e.g., "I am currently in trouble", "I have been in an accident", "my phone is dying", "hospital", "police", "right now", "immediately", "urgent").
  - "Secrecy": Phrases isolating the victim or asking them to hide the call (e.g., "don't tell Mom", "don't tell anyone", "keep this between us", "evariki cheppaku").
  - "Payment Request": Phrases demanding money, transfers, UPI, OTPs, or financial compensation (e.g., "asking for 40,000 rupees as compensation", "Please transfer 40,000 to this UPI ID", "send money now").
- Compute scamLanguageScore from 0.0 (completely benign routine conversation or no speech) to 1.0 (high-pressure financial scam).`;

      const analysisResponseSchema = {
        type: Type.OBJECT,
        properties: {
          syntheticProbability: {
            type: Type.NUMBER,
            description:
              'Probability between 0.0 and 1.0 that the voice is synthetic or cloned.',
          },
          acousticObservations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              '2 to 3 concise acoustic observations about prosody, breathing, noise floor, or phone compression.',
          },
          detectedLanguage: {
            type: Type.STRING,
            description:
              'Detected spoken language(s), e.g., English, Hindi, Telugu, or Telugu / English (Code-Mixed).',
          },
          transcript: {
            type: Type.STRING,
            description:
              'Accurate verbatim speech-to-text transcript preserving the spoken language.',
          },
          englishTranslation: {
            type: Type.STRING,
            description:
              'English translation if non-English or code-mixed; empty string if pure English.',
          },
          flaggedPhrases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: {
                  type: Type.STRING,
                  description: 'Exact substring from transcript.',
                },
                category: {
                  type: Type.STRING,
                  description:
                    'One of: Urgency, Secrecy, Payment Request, Impersonation.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Short plain-language reason why this phrase is risky.',
                },
              },
              required: ['phrase', 'category', 'explanation'],
            },
          },
          scamLanguageScore: {
            type: Type.NUMBER,
            description:
              'Score from 0.0 to 1.0 indicating likelihood of social-engineering scam intent.',
          },
        },
        required: [
          'syntheticProbability',
          'acousticObservations',
          'detectedLanguage',
          'transcript',
          'englishTranslation',
          'flaggedPhrases',
          'scamLanguageScore',
        ],
      };

      const callModelWithRetry = async (modelName: string) => {
        for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
          try {
            return await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMimeType,
                      data: audioBase64!,
                    },
                  },
                  {
                    text: 'Analyze this audio clip for synthetic voice-cloning artifacts and social-engineering scam language, and return JSON matching the schema.',
                  },
                ],
              },
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: analysisResponseSchema,
              },
            });
          } catch (err) {
            const status = getGeminiErrorStatus(err);
            const isTransient = status === 429 || status === 503;
            if (isTransient && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
              await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]);
              continue;
            }
            throw err;
          }
        }
        throw new Error('High traffic — please wait 15 seconds and try again.');
      };

      let response;
      try {
        response = await callModelWithRetry(activeAnalyzeModel);
      } catch (err) {
        const status = getGeminiErrorStatus(err);
        if (activeAnalyzeModel === PRIMARY_ANALYZE_MODEL && status === 404) {
          activeAnalyzeModel = FALLBACK_ANALYZE_MODEL;
          response = await callModelWithRetry(FALLBACK_ANALYZE_MODEL);
        } else {
          throw err;
        }
      }

      audioBase64 = undefined;

      const rawResponseText = typeof response.text === 'string' ? response.text : '';
      const cleanedText = rawResponseText.replace(/```json|```/gi, '').trim();
      if (!cleanedText) {
        res.status(502).json({
          error: 'Gemini returned an empty response while analyzing this audio clip.',
        });
        return;
      }

      let parsed: {
        syntheticProbability?: unknown;
        acousticObservations?: unknown;
        detectedLanguage?: unknown;
        languageDetected?: unknown;
        transcript?: unknown;
        englishTranslation?: unknown;
        flaggedPhrases?: unknown;
        scamLanguageScore?: unknown;
      };

      try {
        parsed = JSON.parse(cleanedText) as typeof parsed;
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(
            cleanedText.slice(firstBrace, lastBrace + 1)
          ) as typeof parsed;
        } else {
          throw new Error(
            `Gemini returned non-JSON analysis output: ${cleanedText.slice(0, 140)}`
          );
        }
      }

      const rawSynthetic = Number(parsed?.syntheticProbability ?? 0.5);
      const syntheticProbability = Number.isFinite(rawSynthetic)
        ? Math.max(0, Math.min(1, rawSynthetic))
        : 0.5;

      const rawScamScore = Number(parsed?.scamLanguageScore ?? 0);
      const scamLanguageScore = Number.isFinite(rawScamScore)
        ? Math.max(0, Math.min(1, rawScamScore))
        : 0;

      const acousticObservations = Array.isArray(parsed?.acousticObservations)
        ? parsed.acousticObservations
            .filter(
              (item): item is string =>
                typeof item === 'string' && item.trim().length > 0
            )
            .slice(0, 4)
        : [];

      const rawFlagged = Array.isArray(parsed?.flaggedPhrases)
        ? parsed.flaggedPhrases
        : [];

      const flaggedPhrases = rawFlagged
        .filter(
          (
            item
          ): item is {
            phrase: string;
            category?: string;
            explanation?: string;
          } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { phrase?: unknown }).phrase === 'string' &&
            (item as { phrase: string }).phrase.trim().length > 0
        )
        .map((item) => ({
          phrase: item.phrase.trim(),
          category:
            typeof item.category === 'string' &&
            ALLOWED_CATEGORIES.has(item.category)
              ? item.category
              : 'Urgency',
          explanation:
            typeof item.explanation === 'string' &&
            item.explanation.trim().length > 0
              ? item.explanation.trim()
              : 'Commonly used in high-pressure phone scams.',
        }));

      const detectedLanguage =
        typeof parsed?.detectedLanguage === 'string' &&
        parsed.detectedLanguage.trim()
          ? parsed.detectedLanguage.trim()
          : typeof parsed?.languageDetected === 'string' &&
              parsed.languageDetected.trim()
            ? parsed.languageDetected.trim()
            : 'Unknown';

      const transcript =
        typeof parsed?.transcript === 'string' && parsed.transcript.trim()
          ? parsed.transcript.trim()
          : 'No speech detected in clip.';

      res.json({
        syntheticProbability,
        acousticObservations,
        detectedLanguage,
        transcript,
        englishTranslation:
          typeof parsed?.englishTranslation === 'string'
            ? parsed.englishTranslation.trim()
            : '',
        flaggedPhrases,
        scamLanguageScore,
      });
    } catch (err) {
      audioBase64 = undefined;
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
    } finally {
      audioBase64 = undefined;
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeVoice Guard server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SafeVoice Guard server:', err);
  process.exit(1);
});
