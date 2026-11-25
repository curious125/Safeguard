import type { DemoScenario } from '../types/safevoice';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.webm', '.ogg'];

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

export function validateAudioFile(file: File): string | null {
  if (file.size === 0) {
    return 'The selected audio file is empty. Please choose another recording.';
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return 'Audio file exceeds the 10 MB limit. Please upload a shorter clip.';
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExt = ACCEPTED_AUDIO_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );
  const hasAudioMime = file.type.startsWith('audio/') || file.type === 'video/webm';

  if (!hasValidExt && !hasAudioMime) {
    return 'Unsupported format. Please upload a .wav, .mp3, .m4a, .webm, or .ogg file.';
  }

  return null;
}

export function normalizeAudioMimeType(fileOrType: File | string): string {
  const rawType =
    typeof fileOrType === 'string' ? fileOrType : fileOrType.type || '';
  const baseType = rawType.split(';')[0].trim().toLowerCase();

  if (baseType === 'audio/m4a' || baseType === 'audio/x-m4a') {
    return 'audio/mp4';
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

  if (typeof fileOrType !== 'string') {
    const name = fileOrType.name.toLowerCase();
    if (name.endsWith('.wav')) return 'audio/wav';
    if (name.endsWith('.mp3')) return 'audio/mpeg';
    if (name.endsWith('.m4a')) return 'audio/mp4';
    if (name.endsWith('.webm')) return 'audio/webm';
    if (name.endsWith('.ogg')) return 'audio/ogg';
  }

  return 'audio/wav';
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
