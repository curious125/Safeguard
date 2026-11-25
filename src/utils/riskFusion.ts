import type {
  AuthenticityLabel,
  FlagCategory,
  FlaggedPhrase,
  RiskFusionResult,
  RiskLevel,
} from '../types/safevoice';

const PAYMENT_KEYWORDS = [
  'upi',
  'rupees',
  'rs',
  '₹',
  'send money',
  'transfer',
  'pampu',
  'bhejo',
  'pay',
  'payment',
  'bank',
  'account',
  'otp',
  'pin',
  'gpay',
  'phonepe',
  'paytm',
  '50,000',
  '30,000',
  'lakh',
  'thousand',
  'cash',
  'wire',
  'dollars',
  '$',
];

export function getAuthenticityLabel(
  syntheticProbability: number
): AuthenticityLabel {
  if (syntheticProbability < 0.35) {
    return 'Likely Real';
  }
  if (syntheticProbability <= 0.65) {
    return 'Uncertain';
  }
  return 'Likely Synthetic';
}

export function detectPaymentMention(
  transcript: string,
  englishTranslation: string,
  flaggedPhrases: FlaggedPhrase[]
): boolean {
  if (flaggedPhrases.some((p) => p.category === 'Payment Request')) {
    return true;
  }
  const combined = `${transcript} ${englishTranslation}`.toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => combined.includes(kw));
}

function formatCategoryPlain(category: FlagCategory): string {
  switch (category) {
    case 'Payment Request':
      return 'money request';
    case 'Urgency':
      return 'time pressure';
    case 'Secrecy':
      return 'secrecy request';
    case 'Impersonation':
      return 'identity claim';
  }
}

export function calculateCombinedRisk(
  syntheticProbability: number,
  scamLanguageScore: number,
  flaggedPhrases: FlaggedPhrase[],
  transcript = '',
  englishTranslation = ''
): RiskFusionResult {
  const clampedSynthetic = Math.max(0, Math.min(1, syntheticProbability));
  const clampedScam = Math.max(0, Math.min(1, scamLanguageScore));
  const authenticityLabel = getAuthenticityLabel(clampedSynthetic);

  const hasPaymentFlag = flaggedPhrases.some(
    (p) => p.category === 'Payment Request'
  );
  const hasPaymentMention = detectPaymentMention(
    transcript,
    englishTranslation,
    flaggedPhrases
  );

  let riskLevel: RiskLevel;

  if (
    clampedSynthetic > 0.65 ||
    (clampedScam >= 0.6 && clampedSynthetic >= 0.35) ||
    (flaggedPhrases.length >= 2 && hasPaymentFlag)
  ) {
    riskLevel = 'HIGH RISK';
  } else if (
    authenticityLabel === 'Uncertain' ||
    flaggedPhrases.length >= 1
  ) {
    riskLevel = 'MEDIUM RISK';
  } else {
    riskLevel = 'LOW RISK';
  }

  const reasons: string[] = [];
  const syntheticPct = Math.round(clampedSynthetic * 100);
  const naturalPct = Math.round((1 - clampedSynthetic) * 100);

  // Reason 1: Voice authenticity signal (never claiming 100% certainty)
  if (authenticityLabel === 'Likely Synthetic') {
    reasons.push(
      `The voice check found strong signs of a cloned or computer-generated voice (${syntheticPct}% synthetic likelihood), though no automated check is 100% certain.`
    );
  } else if (authenticityLabel === 'Uncertain') {
    reasons.push(
      `The voice authenticity check was inconclusive (${syntheticPct}% synthetic likelihood), which often happens on compressed phone calls or when audio has been altered.`
    );
  } else {
    reasons.push(
      `The voice sounds mostly natural (${naturalPct}% natural likelihood), though real callers or skilled impersonators can still try to rush or trick you.`
    );
  }

  // Reason 2: Specific flagged words from transcript
  if (flaggedPhrases.length > 0) {
    const highlighted = flaggedPhrases
      .slice(0, 3)
      .map((item) => `"${item.phrase}" (${formatCategoryPlain(item.category)})`)
      .join(', ');
    reasons.push(
      `Warning phrases appeared in what was said: ${highlighted}. Scammers commonly use these tactics to stop you from checking with family.`
    );
  } else {
    reasons.push(
      'No urgent money requests, secrecy demands, or crisis pressure words were detected in the spoken message.'
    );
  }

  // Reason 3: Overall fusion guidance
  if (riskLevel === 'HIGH RISK') {
    reasons.push(
      'Because this call combines suspicious voice patterns or multiple scam pressure tactics, do not send any money until you call your relative back on their saved number.'
    );
  } else if (riskLevel === 'MEDIUM RISK') {
    reasons.push(
      'Even if the caller sounds somewhat familiar, unclear audio quality or pressure to act fast is a signal to pause and confirm using your Family Safe Word.'
    );
  } else if (hasPaymentMention) {
    reasons.push(
      'Although the call looks calm and natural, money or payment terms were mentioned — always confirm financial requests on a separate call.'
    );
  } else {
    reasons.push(
      'Both the voice pattern and the conversation appear routine, with no signs of urgency, secrecy, or financial pressure.'
    );
  }

  return {
    riskLevel,
    authenticityLabel,
    reasons,
    hasPaymentMention,
  };
}
