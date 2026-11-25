import type { DemoScenario, GeminiAudioAnalysis } from '../types/safevoice';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_AUDIO_EXTENSIONS = [
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.webm',
  '.ogg',
];

export const ACCEPTED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
  'video/webm',
  'audio/ogg',
]);

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'scam-english',
    title: 'Cloned Voice + UPI Scam',
    shortLabel: 'High Risk · English',
    expectedTone: 'Simulated Emergency',
    languageTag: 'English',
    scriptPreview:
      '"Dad, I\'ve been in a car accident, my phone is dying, please don\'t tell Mom, send ₹50,000 to this UPI ID right now."',
  },
  {
    id: 'scam-telugu-mixed',
    title: 'Hospital Urgent Transfer',
    shortLabel: 'Medium/High · Telugu-English',
    expectedTone: 'Code-Mixed Urgency',
    languageTag: 'Telugu / English',
    scriptPreview:
      '"Nanna urgent ga 30,000 pampu, hospital lo unnanu, evariki cheppaku please."',
  },
  {
    id: 'safe-checkin',
    title: 'Benign Family Check-In',
    shortLabel: 'Low Risk · Routine Call',
    expectedTone: 'Normal Conversation',
    languageTag: 'English',
    scriptPreview:
      '"Hey, just checking if you reached home safely. Let\'s have dinner at 8 PM."',
  },
];

export const DEMO_PRESET_ANALYSES: Record<DemoScenario['id'], GeminiAudioAnalysis> = {
  'scam-english': {
    syntheticProbability: 0.84,
    acousticObservations: [
      'Unusually flat pitch cadence and metallic vocal harmonics typical of AI voice cloning.',
      'Missing natural breath intakes between urgent phrases with abrupt noise-floor gating.',
      'Artificially steady syllable pacing despite claimed panic and crisis.',
    ],
    detectedLanguage: 'English',
    transcript:
      "Dad, I've been in a car accident, my phone is dying, please don't tell Mom, send ₹50,000 to this UPI ID right now.",
    englishTranslation: '',
    flaggedPhrases: [
      {
        phrase: 'Dad',
        category: 'Impersonation',
        explanation:
          'Opens with a trusted family identity claim ("Dad") inside an emergency request.',
      },
      {
        phrase: "I've been in a car accident",
        category: 'Urgency',
        explanation:
          'Creates panic with a sudden crisis claim so you act before verifying.',
      },
      {
        phrase: 'my phone is dying',
        category: 'Urgency',
        explanation:
          'Creates artificial time pressure so you send money before hanging up to check.',
      },
      {
        phrase: "please don't tell Mom",
        category: 'Secrecy',
        explanation:
          'Tries to isolate you from other relatives who could confirm your family member is safe.',
      },
      {
        phrase: 'send ₹50,000 to this UPI ID right now',
        category: 'Payment Request',
        explanation:
          'Demands an instant, hard-to-reverse UPI payment under high emotional stress.',
      },
    ],
    scamLanguageScore: 0.96,
  },
  'scam-telugu-mixed': {
    syntheticProbability: 0.56,
    acousticObservations: [
      'Narrowband phone-line compression obscures subtle vocal micro-tremors.',
      'Uneven cadence on stressed Telugu syllables places voice authenticity in the Uncertain band.',
      'Brief noise-floor cutoffs appear between Telugu and English phrases.',
    ],
    detectedLanguage: 'Telugu / English (Code-Mixed)',
    transcript:
      'Nanna urgent ga 30,000 pampu, hospital lo unnanu, evariki cheppaku please.',
    englishTranslation:
      'Dad, send 30,000 urgently, I am in the hospital, please do not tell anyone.',
    flaggedPhrases: [
      {
        phrase: 'Nanna',
        category: 'Impersonation',
        explanation:
          'Opens by addressing you as a parent ("Nanna") to establish immediate family trust.',
      },
      {
        phrase: 'urgent ga',
        category: 'Urgency',
        explanation: 'Pressures you to rush without verifying the caller.',
      },
      {
        phrase: 'hospital lo unnanu',
        category: 'Urgency',
        explanation: 'Uses a sudden hospital crisis claim to trigger panic.',
      },
      {
        phrase: '30,000 pampu',
        category: 'Payment Request',
        explanation: 'Requests an immediate ₹30,000 transfer.',
      },
      {
        phrase: 'evariki cheppaku',
        category: 'Secrecy',
        explanation: 'Asks you to hide the money request from other family members.',
      },
    ],
    scamLanguageScore: 0.91,
  },
  'safe-checkin': {
    syntheticProbability: 0.12,
    acousticObservations: [
      'Natural vocal pitch contours, organic breath pauses, and subtle human micro-tremors.',
      'Consistent background room ambiance throughout the clip with no gating artifacts.',
      'Smooth consonant and vowel transitions consistent with genuine live speech.',
    ],
    detectedLanguage: 'English',
    transcript:
      "Hey, just checking if you reached home safely. Let's have dinner at 8 PM.",
    englishTranslation: '',
    flaggedPhrases: [],
    scamLanguageScore: 0.04,
  },
};

export function validateAudioFile(file: File | Blob): string | null {
  if (file.size === 0) {
    return 'The selected audio clip is empty. Please choose another recording.';
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return 'Audio file exceeds the 10 MB limit. Please upload a shorter clip.';
  }

  const baseMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const hasValidMime =
    ACCEPTED_AUDIO_MIME_TYPES.has(baseMime) ||
    baseMime.startsWith('audio/') ||
    baseMime === 'video/webm';

  if (file instanceof File) {
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ACCEPTED_AUDIO_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    if (!hasValidExt && !hasValidMime) {
      return 'Unsupported format. Please upload a .wav, .mp3, .m4a, .webm, or .ogg file.';
    }
    return null;
  }

  if (baseMime === '' || hasValidMime) {
    return null;
  }

  return 'Unsupported audio format. Please record again or upload a WAV, MP3, M4A, WebM, or OGG clip.';
}

export function normalizeAudioMimeType(fileOrBlob: File | Blob | string): string {
  const rawType =
    typeof fileOrBlob === 'string' ? fileOrBlob : fileOrBlob.type || '';
  const baseType = rawType.split(';')[0].trim().toLowerCase();

  if (baseType === 'audio/m4a' || baseType === 'audio/x-m4a') {
    return 'audio/mp4';
  }
  if (baseType === 'audio/mp3') {
    return 'audio/mpeg';
  }
  if (baseType === 'audio/x-wav' || baseType === 'audio/wave') {
    return 'audio/wav';
  }
  if (baseType === 'video/webm') {
    return 'audio/webm';
  }
  if (baseType.startsWith('audio/')) {
    return baseType;
  }

  if (typeof fileOrBlob !== 'string' && 'name' in fileOrBlob) {
    const name = fileOrBlob.name.toLowerCase();
    if (name.endsWith('.wav')) return 'audio/wav';
    if (name.endsWith('.mp3')) return 'audio/mpeg';
    if (name.endsWith('.m4a')) return 'audio/mp4';
    if (name.endsWith('.aac')) return 'audio/aac';
    if (name.endsWith('.webm')) return 'audio/webm';
    if (name.endsWith('.ogg')) return 'audio/ogg';
  }

  return 'audio/webm';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read audio buffer in memory.'));
        return;
      }
      const rawBase64 = result.split(',')[1];
      if (!rawBase64) {
        reject(new Error('Invalid audio encoding format.'));
        return;
      }
      resolve(rawBase64);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the audio clip from memory.'));
    };
    reader.readAsDataURL(blob);
  });
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
