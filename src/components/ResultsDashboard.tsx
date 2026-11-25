import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  CheckCircle2,
  Languages,
  MessageSquareWarning,
  ShieldAlert,
} from 'lucide-react';
import type {
  FlagCategory,
  FlaggedPhrase,
  FullAnalysisReport,
} from '../types/safevoice';

interface ResultsDashboardProps {
  report: FullAnalysisReport;
}

function getCategoryStyles(category: FlagCategory): {
  markClass: string;
  labelClass: string;
} {
  switch (category) {
    case 'Payment Request':
      return {
        markClass: 'bg-red-100 text-red-950 border border-red-300',
        labelClass: 'text-red-800',
      };
    case 'Urgency':
      return {
        markClass: 'bg-amber-100 text-amber-950 border border-amber-300',
        labelClass: 'text-amber-800',
      };
    case 'Secrecy':
      return {
        markClass: 'bg-purple-100 text-purple-950 border border-purple-300',
        labelClass: 'text-purple-800',
      };
    case 'Impersonation':
      return {
        markClass: 'bg-blue-100 text-blue-950 border border-blue-300',
        labelClass: 'text-blue-800',
      };
  }
}

interface HighlightSegment {
  text: string;
  match?: FlaggedPhrase;
}

function buildHighlightedSegments(
  transcript: string,
  flaggedPhrases: FlaggedPhrase[]
): HighlightSegment[] {
  if (!transcript || flaggedPhrases.length === 0) {
    return [{ text: transcript }];
  }

  const lowerTranscript = transcript.toLowerCase();
  const spans: { start: number; end: number; match: FlaggedPhrase }[] = [];

  for (const item of flaggedPhrases) {
    const target = item.phrase.trim();
    if (!target) continue;
    const idx = lowerTranscript.indexOf(target.toLowerCase());
    if (idx !== -1) {
      const overlaps = spans.some(
        (s) => idx < s.end && idx + target.length > s.start
      );
      if (!overlaps) {
        spans.push({
          start: idx,
          end: idx + target.length,
          match: item,
        });
      }
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: transcript.slice(cursor, span.start) });
    }
    segments.push({
      text: transcript.slice(span.start, span.end),
      match: span.match,
    });
    cursor = span.end;
  }

  if (cursor < transcript.length) {
    segments.push({ text: transcript.slice(cursor) });
  }

  return segments;
}

export function ResultsDashboard({ report }: ResultsDashboardProps) {
  const { analysis, fusion, clipLabel, processingMs } = report;
  const [selectedPhrase, setSelectedPhrase] = useState<FlaggedPhrase | null>(
    analysis.flaggedPhrases[0] ?? null
  );

  const syntheticPct = Math.round(analysis.syntheticProbability * 100);
  const scamPct = Math.round(analysis.scamLanguageScore * 100);

  let bannerStyles = {
    wrapper: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    iconBg: 'bg-emerald-700 text-white',
    heading: 'Low Risk — Routine Call Indicators',
    sub: 'Voice acoustics look natural and no scam pressure phrases were found.',
    icon: <CheckCircle2 className="w-7 h-7" aria-hidden="true" />,
  };

  if (fusion.riskLevel === 'HIGH RISK') {
    bannerStyles = {
      wrapper: 'bg-red-50 border-red-300 text-red-950',
      iconBg: 'bg-red-700 text-white',
      heading: 'High Risk — Possible Voice-Clone or Scam Call',
      sub: 'Do not send money or share codes. Pause and verify with your family first.',
      icon: <ShieldAlert className="w-7 h-7" aria-hidden="true" />,
    };
  } else if (fusion.riskLevel === 'MEDIUM RISK') {
    bannerStyles = {
      wrapper: 'bg-amber-50 border-amber-300 text-amber-950',
      iconBg: 'bg-amber-600 text-white',
      heading: 'Medium Risk — Caution Recommended',
      sub: 'Verify the caller independently before acting on any request.',
      icon: <AlertTriangle className="w-7 h-7" aria-hidden="true" />,
    };
  }

  const segments = buildHighlightedSegments(
    analysis.transcript,
    analysis.flaggedPhrases
  );

  return (
    <section aria-labelledby="results-heading" className="space-y-6">
      {/* 1. Primary Visual Risk Meter Banner */}
      <div
        className={`rounded-xl border p-6 sm:p-8 shadow-xs ${bannerStyles.wrapper}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${bannerStyles.iconBg}`}
            >
              {bannerStyles.icon}
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide uppercase">
                {fusion.riskLevel}
              </div>
              <h2
                id="results-heading"
                className="text-2xl sm:text-3xl font-bold mt-1 text-balance"
              >
                {bannerStyles.heading}
              </h2>
              <p className="text-base mt-1.5 opacity-90">{bannerStyles.sub}</p>
            </div>
          </div>

          <div className="text-sm font-medium opacity-80 md:text-right shrink-0 tabular-nums">
            <div>{clipLabel}</div>
            <div className="mt-1">
              {analysis.detectedLanguage} · Analyzed in {(processingMs / 1000).toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Plain-Language Reasons for Older Adults */}
        <div className="mt-6 pt-6 border-t border-black/10">
          <h3 className="text-base font-bold mb-3">
            Why SafeVoice Guard Flagged This Result
          </h3>
          <ul className="space-y-2.5 text-base leading-relaxed">
            {fusion.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono font-bold mt-0.5 shrink-0">
                  {idx + 1}.
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 2. Dual-Signal Breakdown (Voice Authenticity + Scam Script Analysis) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Signal A: Voice Authenticity */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AudioWaveform
                  className="w-5 h-5 text-slate-700 shrink-0"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-bold text-slate-900">
                  Voice Authenticity Check
                </h3>
              </div>
              <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                {syntheticPct}% synthetic
              </span>
            </div>

            <div className="mt-3 text-base font-semibold text-slate-800">
              Assessment: {fusion.authenticityLabel}
            </div>

            {/* 3-Zone Gauge with Uncertain Phone-Compression Band */}
            <div className="mt-5">
              <div className="relative h-4 rounded-md overflow-hidden flex border border-slate-200">
                <div
                  className="bg-emerald-500/85 h-full"
                  style={{ width: '35%' }}
                  title="0–35%: Likely Real"
                />
                <div
                  className="bg-amber-400/90 h-full border-x border-white/70"
                  style={{ width: '30%' }}
                  title="35–65%: Uncertain (Phone Compression Zone)"
                />
                <div
                  className="bg-red-500/85 h-full"
                  style={{ width: '35%' }}
                  title="65–100%: Likely Synthetic"
                />
                {/* Indicator Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-slate-950 ring-2 ring-white"
                  style={{
                    left: `calc(${Math.min(98, Math.max(2, syntheticPct))}% - 2px)`,
                  }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2 grid grid-cols-3 text-xs font-medium text-slate-600 tabular-nums">
                <div>0–35% Likely Real</div>
                <div className="text-center">35–65% Uncertain</div>
                <div className="text-right">65–100% Synthetic</div>
              </div>
            </div>

            {/* Acoustic Observations */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 mb-2.5">
                Acoustic Signals Observed
              </h4>
              {analysis.acousticObservations.length > 0 ? (
                <ul className="space-y-2 text-sm sm:text-base text-slate-700 leading-relaxed">
                  {analysis.acousticObservations.map((obs, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-slate-400 mt-1">
                        •
                      </span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm sm:text-base text-slate-600">
                  Evaluated vocal prosody, breathing cadence, and background noise consistency.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Signal B: Scam Script Analysis */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <MessageSquareWarning
                  className="w-5 h-5 text-slate-700 shrink-0"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-bold text-slate-900">
                  Scam Script Analysis
                </h3>
              </div>
              <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                {scamPct}% risk score
              </span>
            </div>

            <div className="mt-3 text-sm sm:text-base text-slate-700">
              Spoken Language: <span className="font-semibold text-slate-900">{analysis.detectedLanguage}</span>
              {' · '}
              <span className="font-semibold text-slate-900 tabular-nums">
                {analysis.flaggedPhrases.length}
              </span>{' '}
              flagged {analysis.flaggedPhrases.length === 1 ? 'phrase' : 'phrases'}
            </div>

            {/* Scam Score Progress Bar */}
            <div className="mt-5">
              <div className="h-4 w-full rounded-md bg-slate-100 border border-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    scamPct >= 60
                      ? 'bg-red-600'
                      : scamPct >= 30
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.max(4, scamPct)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs font-medium text-slate-600 tabular-nums">
                <span>0% Benign Conversation</span>
                <span>60%+ High Scam Intent</span>
              </div>
            </div>

            {/* Flagged Phrases Detail List */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 mb-3">
                Detected Manipulation Tactics
              </h4>
              {analysis.flaggedPhrases.length > 0 ? (
                <div className="space-y-2.5">
                  {analysis.flaggedPhrases.map((item, idx) => {
                    const styles = getCategoryStyles(item.category);
                    const isSelected =
                      selectedPhrase?.phrase === item.phrase &&
                      selectedPhrase?.category === item.category;
                    return (
                      <button
                        key={`${item.phrase}-${idx}`}
                        type="button"
                        onClick={() => setSelectedPhrase(item)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-slate-50 border-slate-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold text-slate-900 text-base">
                            “{item.phrase}”
                          </span>
                          <span className={`text-xs font-bold ${styles.labelClass}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {item.explanation}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm sm:text-base text-slate-600">
                  No urgency, secrecy, impersonation, or payment-request triggers were found in the transcript.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Highlighted Transcript */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Languages className="w-5 h-5 text-slate-700 shrink-0" aria-hidden="true" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Transcript &amp; Highlighted Warning Phrases
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
            <span className="text-red-800">Red: Payment Request</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-800">Amber: Urgency</span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-800">Purple: Secrecy</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-800">Blue: Impersonation</span>
          </div>
        </div>

        <div className="mt-5 text-lg sm:text-xl leading-relaxed text-slate-900">
          {analysis.transcript ? (
            <p className="leading-[1.8]">
              {segments.map((seg, i): ReactNode => {
                if (!seg.match) {
                  return <span key={i}>{seg.text}</span>;
                }
                const styles = getCategoryStyles(seg.match.category);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPhrase(seg.match ?? null)}
                    className={`inline align-baseline mx-0.5 px-2 py-0.5 rounded-md font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${styles.markClass}`}
                    title={`${seg.match.category}: ${seg.match.explanation}`}
                  >
                    <span>{seg.text}</span>
                    <span className="ml-1.5 text-xs font-bold opacity-80">
                      [{seg.match.category}]
                    </span>
                  </button>
                );
              })}
            </p>
          ) : (
            <p className="text-base text-slate-500">
              No intelligible speech was detected in this audio recording.
            </p>
          )}
        </div>

        {selectedPhrase && (
          <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm sm:text-base text-slate-800">
            <span className="font-bold">{selectedPhrase.category}:</span>{' '}
            <span>{selectedPhrase.explanation}</span>
          </div>
        )}

        {analysis.englishTranslation && (
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-sm font-bold text-slate-600">
              English Translation
            </div>
            <p className="mt-1.5 text-base sm:text-lg text-slate-800 leading-relaxed">
              {analysis.englishTranslation}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
