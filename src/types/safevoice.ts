export type AuthenticityLabel = 'Likely Real' | 'Uncertain' | 'Likely Synthetic';

export type RiskLevel = 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';

export type FlagCategory =
  | 'Urgency'
  | 'Secrecy'
  | 'Payment Request'
  | 'Impersonation';

export interface FlaggedPhrase {
  phrase: string;
  category: FlagCategory;
  explanation: string;
}

export interface GeminiAudioAnalysis {
  syntheticProbability: number;
  acousticObservations: string[];
  detectedLanguage: string;
  transcript: string;
  englishTranslation: string;
  flaggedPhrases: FlaggedPhrase[];
  scamLanguageScore: number;
}

export interface RiskFusionResult {
  riskLevel: RiskLevel;
  authenticityLabel: AuthenticityLabel;
  reasons: string[];
  hasPaymentMention: boolean;
}

export interface FullAnalysisReport {
  analysis: GeminiAudioAnalysis;
  fusion: RiskFusionResult;
  analyzedAt: string;
  clipLabel: string;
  processingMs: number;
}

export interface TrustedContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface FamilyCircleConfig {
  safeWord: string;
  contacts: TrustedContact[];
}

export interface DemoScenario {
  id: 'scam-english' | 'scam-telugu-mixed' | 'safe-checkin';
  title: string;
  shortLabel: string;
  expectedTone: string;
  languageTag: string;
  scriptPreview: string;
}
