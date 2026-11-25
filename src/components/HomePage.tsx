import { useState } from 'react';
import {
  ArrowRight,
  AudioWaveform,
  KeyRound,
  Languages,
  Lock,
  MessageSquareWarning,
  Mic,
  Play,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import type { DemoScenario, FamilyCircleConfig } from '../types/safevoice';

const HERO_ILLUSTRATION_SRC = '/assets/aistudio/image_70a64f65.png';
const HERO_ILLUSTRATION_ALT =
  'An older woman and a young man securely connecting under the protective digital shield of SafeVoice Guard.';

interface HomePageProps {
  onGoToAnalyzer: () => void;
  onGoToFamilyCircle: () => void;
  onRunLiveDemo: (scenarioId: DemoScenario['id']) => void;
  storedFamilyCircle: FamilyCircleConfig | null;
}

interface HomeScenarioCard {
  id: DemoScenario['id'];
  title: string;
  description: string;
  language: string;
  riskTag: string;
  toneClass: string;
}

const HOME_DEMO_CARDS: HomeScenarioCard[] = [
  {
    id: 'scam-english',
    title: 'Fake Accident & ₹50,000 UPI Scam (English)',
    description:
      '"Son" calls from an unknown number asking for secret emergency money.',
    language: 'English',
    riskTag: 'High Risk Scenario',
    toneClass: 'text-red-700',
  },
  {
    id: 'scam-telugu-mixed',
    title: 'Urgent Hospital Request (Telugu / Hindi)',
    description:
      'Code-mixed urgent plea asking not to tell anyone.',
    language: 'Telugu / Hindi / English',
    riskTag: 'Medium / High Risk Scenario',
    toneClass: 'text-amber-700',
  },
  {
    id: 'safe-checkin',
    title: 'Normal Family Call (Safe Baseline)',
    description:
      'Everyday check-in call to demonstrate low false alarms.',
    language: 'English',
    riskTag: 'Low Risk Baseline',
    toneClass: 'text-emerald-700',
  },
];

export function HomePage({
  onGoToAnalyzer,
  onGoToFamilyCircle,
  onRunLiveDemo,
  storedFamilyCircle,
}: HomePageProps) {
  const [heroImageError, setHeroImageError] = useState(false);

  return (
    <div className="space-y-10 sm:space-y-12 min-w-0">
      {/* 1. Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-10 lg:p-12 shadow-xs min-w-0"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-x-10 lg:gap-y-6 items-center md:py-4 min-w-0">
          {/* Headline & Subheadline (Mobile: 1st, Desktop: Left Top) */}
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end min-w-0">
            <p className="text-sm font-semibold text-blue-700">
              Voice-Clone &amp; Scam Call Verification
            </p>
            <h1
              id="hero-heading"
              className="mt-2 text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight text-slate-900 leading-[1.16] break-words text-balance"
            >
              Is That Urgent Call Really Your Family—Or an AI Voice Clone?
            </h1>
            <p className="mt-4 text-base sm:text-xl text-slate-600 leading-relaxed break-words">
              Upload a voice note or record a call clip to detect synthetic voice cloning and scam pressure tactics in under 10 seconds.
            </p>
          </div>

          {/* Visual Trust Illustration (Mobile: 2nd before CTAs, Desktop: Right Column) */}
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center w-full max-h-[340px] md:max-h-[440px] flex justify-center lg:justify-end items-center animate-fade-in mb-0 pb-0 min-w-0">
            {heroImageError ? (
              <div
                role="img"
                aria-label={HERO_ILLUSTRATION_ALT}
                className="w-full max-w-[520px] h-[260px] sm:h-[300px] rounded-2xl md:rounded-3xl bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 border border-teal-500/10 shadow-lg shadow-teal-500/5 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-teal-700 text-white flex items-center justify-center mb-4">
                  <ShieldCheck className="w-8 h-8" aria-hidden="true" />
                </div>
                <p className="text-base font-bold text-slate-900">
                  Protected Family Voice Verification
                </p>
              </div>
            ) : (
              <img
                src={HERO_ILLUSTRATION_SRC}
                alt={HERO_ILLUSTRATION_ALT}
                referrerPolicy="no-referrer"
                onError={() => setHeroImageError(true)}
                className="w-full max-w-[540px] max-h-[340px] md:max-h-[440px] h-auto rounded-2xl md:rounded-3xl border border-teal-500/10 shadow-lg shadow-teal-500/5 object-contain hover:scale-[1.01] transition-transform duration-300"
              />
            )}
          </div>

          {/* Primary & Secondary CTAs + Privacy Notice (Mobile: 3rd below image, Desktop: Left Bottom) */}
          <div className="lg:col-start-1 lg:row-start-2 lg:self-start min-w-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3.5 sm:gap-4">
              <button
                type="button"
                onClick={onGoToAnalyzer}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3 sm:py-4 min-h-[48px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-base sm:text-lg font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Mic className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Analyze a Voice Clip</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onGoToFamilyCircle}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3 sm:py-4 min-h-[48px] rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-base sm:text-lg font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <KeyRound className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Set Up Family Safe Word</span>
              </button>
            </div>

            {/* Privacy Trust Notice */}
            <div className="mt-5 flex items-start sm:items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm sm:text-base text-slate-700 min-w-0">
              <Lock
                className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">
                <strong className="font-semibold text-slate-900">
                  Zero Audio Storage:
                </strong>{' '}
                Clips are processed in memory and deleted immediately after scoring.
              </span>
            </div>
          </div>
        </div>

        {/* Responsive Trust & Verification Bar */}
        <div
          aria-label="Security and privacy guarantees"
          className="mt-8 pt-6 border-t border-slate-200/80 flex flex-wrap gap-4 sm:gap-6 items-start justify-center lg:justify-start"
        >
          <div className="flex items-start gap-3 w-full md:w-auto md:flex-1 md:min-w-[220px] min-w-0">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900">
                Verified Secure
              </div>
              <p className="text-sm text-slate-600 leading-snug break-words">
                Advanced ML Spoofing &amp; Linguistic Scans
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 w-full md:w-auto md:flex-1 md:min-w-[220px] min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900">
                Privacy Guarded
              </div>
              <p className="text-sm text-slate-600 leading-snug break-words">
                100% In-Memory Processing — Audio deleted instantly
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 w-full md:w-auto md:flex-1 md:min-w-[220px] min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900">
                Family First
              </div>
              <p className="text-sm text-slate-600 leading-snug break-words">
                Call back securely with preset Safe Words
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Active Family Protection Banner (Reads from localStorage) */}
      <section aria-label="Family Circle Protection Status" className="min-w-0">
        {storedFamilyCircle ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="text-base sm:text-lg font-semibold text-emerald-950 tabular-nums min-w-0 break-words">
                Family Circle Active <span aria-hidden="true">•</span> Safe Word Protected{' '}
                <span aria-hidden="true">•</span> {storedFamilyCircle.contacts.length}{' '}
                Trusted {storedFamilyCircle.contacts.length === 1 ? 'Contact' : 'Contacts'} Ready
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToFamilyCircle}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg bg-white hover:bg-emerald-100/60 border border-emerald-300 text-sm sm:text-base font-semibold text-emerald-950 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Edit</span>
            </button>
          </div>
        ) : (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-bold text-amber-950 break-words">
                  Set Your Family Safe Word Before an Emergency Happens
                </div>
                <p className="text-sm sm:text-base text-amber-900 mt-0.5 break-words">
                  Sign in and save a secret family phrase plus trusted callback numbers so they appear instantly during a suspicious call.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToFamilyCircle}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm sm:text-base font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <span>Set Safe Word</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. How Layered Protection Works (3-Card Section) */}
      <section aria-labelledby="layered-protection-heading" className="min-w-0">
        <div className="mb-6">
          <h2
            id="layered-protection-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
          >
            How Layered Protection Works
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-1.5">
            Acoustic forensics, multilingual scam-phrase detection, and human verification work together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4">
              <AudioWaveform className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Voice Authenticity Check
            </h3>
            <p className="mt-2.5 text-base text-slate-600 leading-relaxed break-words">
              Scans vocal patterns for AI cloning artifacts, using an honest{' '}
              <em className="not-italic font-semibold text-slate-800">
                “Uncertain”
              </em>{' '}
              band when phone-line quality is poor.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4">
              <MessageSquareWarning className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Scam Script Detector
            </h3>
            <p className="mt-2.5 text-base text-slate-600 leading-relaxed break-words">
              Highlights manipulation triggers (
              <em className="not-italic font-semibold text-slate-800">
                Urgency, Secrecy, Payment Requests, Impersonation
              </em>
              ) in <strong className="text-slate-900">English, Hindi, and Telugu</strong>.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Out-of-Band Safe Word
            </h3>
            <p className="mt-2.5 text-base text-slate-600 leading-relaxed break-words">
              Guides you to hang up, call back on a saved trusted number, and verify your secret family phrase.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Try Real Scam Scenarios Interactive Demo Cards */}
      <section aria-labelledby="demo-scenarios-heading" className="min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
          <div className="min-w-0">
            <h2
              id="demo-scenarios-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
            >
              Try Real Scam Scenarios
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-1.5">
              Click any scenario to view instant pre-computed scam and voice-clone detection results without using API quota.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 shrink-0">
            <Languages className="w-4 h-4" aria-hidden="true" />
            <span>Instant multilingual demo presets</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {HOME_DEMO_CARDS.map((card) => (
            <div
              key={card.id}
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-xs min-w-0"
            >
              <div className="min-w-0">
                <div className={`text-xs font-bold break-words ${card.toneClass}`}>
                  {card.riskTag} · {card.language}
                </div>
                <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 leading-snug break-words">
                  {card.title}
                </h3>
                <p className="mt-2.5 text-base text-slate-600 leading-relaxed break-words">
                  {card.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRunLiveDemo(card.id)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>View Demo Result</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
