import type { FlaggedPhrase, GeminiAudioAnalysis } from '../types/safevoice';
import { blobToBase64, normalizeAudioMimeType } from '../utils/audioHelpers';
import { normalizeFlaggedPhrases } from '../utils/riskFusion';

type AnalyzeResponsePayload = Partial<GeminiAudioAnalysis> & {
  error?: string;
  languageDetected?: unknown;
};

export class UnauthorizedAnalysisError extends Error {
  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'UnauthorizedAnalysisError';
  }
}

export async function analyzeAudioViaServer(
  fileOrBlob: File | Blob,
  token: string,
  preferredMimeType?: string
): Promise<GeminiAudioAnalysis> {
  const audioBase64 = await blobToBase64(fileOrBlob);
  const mimeType = normalizeAudioMimeType(preferredMimeType || fileOrBlob);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      audioBase64,
      mimeType,
    }),
  });

  if (response.status === 401) {
    throw new UnauthorizedAnalysisError();
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawResponseText = await response.text();
  const cleanedResponseText = rawResponseText
    .replace(/```json|```/gi, '')
    .trim();

  if (contentType.includes('text/html') || cleanedResponseText.startsWith('<')) {
    throw new Error(
      'Unable to reach the audio analysis service. Please refresh and try again.'
    );
  }

  let payload: AnalyzeResponsePayload | null = null;
  if (cleanedResponseText) {
    try {
      payload = JSON.parse(cleanedResponseText) as AnalyzeResponsePayload;
    } catch {
      const firstBrace = cleanedResponseText.indexOf('{');
      const lastBrace = cleanedResponseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        payload = JSON.parse(
          cleanedResponseText.slice(firstBrace, lastBrace + 1)
        ) as AnalyzeResponsePayload;
      } else if (response.ok) {
        throw new Error(
          `Invalid JSON response from analyzer: ${cleanedResponseText.slice(0, 140)}`
        );
      }
    }
  }

  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      throw new Error('High traffic — please wait 15 seconds and try again.');
    }
    const detail =
      payload?.error ||
      (cleanedResponseText
        ? cleanedResponseText.slice(0, 240)
        : `Server returned HTTP ${response.status}`);
    throw new Error(detail);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Analyzer returned an empty or malformed response.');
  }

  const rawSynth = Number(payload.syntheticProbability ?? 0.5);
  const syntheticProbability = Number.isFinite(rawSynth)
    ? Math.max(0, Math.min(1, rawSynth))
    : 0.5;

  const rawScam = Number(payload.scamLanguageScore ?? 0);
  const scamLanguageScore = Number.isFinite(rawScam)
    ? Math.max(0, Math.min(1, rawScam))
    : 0;

  const transcript = String(
    typeof payload.transcript === 'string' && payload.transcript.trim()
      ? payload.transcript.trim()
      : 'No speech detected in clip.'
  );

  const detectedLanguage = String(
    (typeof payload.detectedLanguage === 'string' &&
    payload.detectedLanguage.trim()
      ? payload.detectedLanguage.trim()
      : '') ||
      (typeof payload.languageDetected === 'string' &&
      payload.languageDetected.trim()
        ? payload.languageDetected.trim()
        : '') ||
      'Unknown'
  );

  const englishTranslation =
    typeof payload.englishTranslation === 'string'
      ? payload.englishTranslation.trim()
      : '';

  const acousticObservations = Array.isArray(payload.acousticObservations)
    ? payload.acousticObservations.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0
      )
    : [];

  const flaggedPhrases: FlaggedPhrase[] = normalizeFlaggedPhrases(
    payload.flaggedPhrases,
    transcript === 'No speech detected in clip.' ? '' : transcript
  );

  return {
    syntheticProbability,
    acousticObservations,
    detectedLanguage,
    transcript,
    englishTranslation,
    flaggedPhrases,
    scamLanguageScore,
  };
}
