import { useEffect, useRef, useState } from 'react';
import { Mic, ShieldCheck } from 'lucide-react';
import {
  AudioCaptureCard,
  type CaptureTab,
  type LoadedAudioClip,
} from './components/AudioCaptureCard';
import { AuthScreen, type AuthSessionPayload } from './components/AuthScreen';
import { FamilyCircleView } from './components/FamilyCircleView';
import { Header, type ActiveView } from './components/Header';
import { HomePage } from './components/HomePage';
import { RecommendedActionPanel } from './components/RecommendedActionPanel';
import { ResultsDashboard } from './components/ResultsDashboard';
import type {
  DemoScenario,
  FamilyCircleConfig,
  FullAnalysisReport,
  GeminiAudioAnalysis,
} from './types/safevoice';
import {
  blobToBase64,
  DEMO_PRESET_ANALYSES,
  DEMO_SCENARIOS,
} from './utils/audioHelpers';
import {
  clearFamilyCircleStorage,
  DEFAULT_FAMILY_CIRCLE,
  readFamilyCircleFromStorage,
  saveFamilyCircle,
} from './utils/familyCircle';
import {
  calculateCombinedRisk,
  normalizeFlaggedPhrases,
} from './utils/riskFusion';

interface ActiveSession {
  token: string;
  username: string;
}

type PendingAction =
  | { type: 'verify' }
  | { type: 'family' }
  | { type: 'demo'; scenarioId: DemoScenario['id'] }
  | null;

export default function App() {
  const [authSession, setAuthSession] = useState<ActiveSession | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [captureTab, setCaptureTab] = useState<CaptureTab>('upload');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [audioClip, setAudioClip] = useState<LoadedAudioClip | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bufferClearedNotice, setBufferClearedNotice] = useState(false);
  const [report, setReport] = useState<FullAnalysisReport | null>(null);

  const [storedFamilyCircle, setStoredFamilyCircle] =
    useState<FamilyCircleConfig | null>(() => readFamilyCircleFromStorage());

  const [familyCircle, setFamilyCircle] = useState<FamilyCircleConfig>(
    () => readFamilyCircleFromStorage() ?? DEFAULT_FAMILY_CIRCLE
  );

  const captureSectionRef = useRef<HTMLDivElement | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const analyzingLockRef = useRef(false);

  // Revoke any dangling objectURL on unmount
  useEffect(() => {
    return () => {
      if (audioClip?.objectUrl) {
        URL.revokeObjectURL(audioClip.objectUrl);
      }
    };
  }, [audioClip]);

  function handleSelectView(view: ActiveView) {
    if ((view === 'verify' || view === 'family') && !authSession) {
      setPendingAction({ type: view });
      setAuthNotice(
        view === 'family'
          ? 'Sign in to view and edit your saved Family Safe Word and trusted contacts.'
          : 'Sign in to access your saved account and verify audio clips.'
      );
      setActiveView('auth');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setAuthNotice(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAuthenticated(payload: AuthSessionPayload) {
    const session: ActiveSession = {
      token: payload.token,
      username: payload.username,
    };

    setAuthSession(session);
    setFamilyCircle(payload.familyCircle);
    saveFamilyCircle(payload.familyCircle);
    setStoredFamilyCircle(payload.familyCircle);

    setReport(null);
    setErrorMessage(null);
    setBufferClearedNotice(false);
    setAuthNotice(null);

    const action = pendingAction;
    setPendingAction(null);

    if (action?.type === 'family') {
      setActiveView('family');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action?.type === 'verify') {
      setActiveView('verify');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action?.type === 'demo') {
      runLocalDemoScenario(action.scenarioId);
      return;
    }

    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSignOut() {
    const token = authSession?.token;
    if (audioClip?.objectUrl) {
      URL.revokeObjectURL(audioClip.objectUrl);
    }

    setAuthSession(null);
    setAudioClip(null);
    setReport(null);
    setErrorMessage(null);
    setBufferClearedNotice(false);
    setPendingAction(null);
    setAuthNotice(null);

    clearFamilyCircleStorage();
    setStoredFamilyCircle(null);
    setFamilyCircle(DEFAULT_FAMILY_CIRCLE);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => undefined);
    }
  }

  async function handleUpdateFamilyCircle(next: FamilyCircleConfig) {
    setFamilyCircle(next);
    saveFamilyCircle(next);
    setStoredFamilyCircle(next);

    if (!authSession) return;

    try {
      const response = await fetch('/api/account/family-circle', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.token}`,
        },
        body: JSON.stringify(next),
      });
      if (response.status === 401) {
        await handleSignOut();
        return;
      }
      if (response.ok) {
        const data = (await response.json()) as {
          familyCircle?: FamilyCircleConfig;
        };
        if (data.familyCircle) {
          setFamilyCircle(data.familyCircle);
          saveFamilyCircle(data.familyCircle);
          setStoredFamilyCircle(data.familyCircle);
        }
      }
    } catch {
      // Keep optimistic state responsive on transient network error
    }
  }

  function handleClipLoaded(nextClip: LoadedAudioClip) {
    if (audioClip?.objectUrl) {
      URL.revokeObjectURL(audioClip.objectUrl);
    }
    setAudioClip(nextClip);
    setBufferClearedNotice(false);
    setErrorMessage(null);
  }

  function handleClearClip() {
    if (audioClip?.objectUrl) {
      URL.revokeObjectURL(audioClip.objectUrl);
    }
    setAudioClip(null);
    setBufferClearedNotice(false);
    setErrorMessage(null);
  }

  async function analyzeClipWithToken(clip: LoadedAudioClip, token: string) {
    if (analyzingLockRef.current) return;
    analyzingLockRef.current = true;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setBufferClearedNotice(false);

    const startedAt = performance.now();
    let audioBase64: string | null = null;
    let didSucceed = false;

    try {
      audioBase64 = await blobToBase64(clip.blob);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: clip.mimeType,
        }),
      });

      if (response.status === 401) {
        await handleSignOut();
        return;
      }

      const rawResponseText = await response.text();
      const cleanedResponseText = rawResponseText
        .replace(/```json|```/gi, '')
        .trim();

      type AnalyzeResponsePayload = Partial<GeminiAudioAnalysis> & {
        error?: string;
        languageDetected?: unknown;
      };

      let payload: AnalyzeResponsePayload | null = null;

      if (cleanedResponseText) {
        try {
          payload = JSON.parse(
            cleanedResponseText
          ) as AnalyzeResponsePayload | null;
        } catch {
          if (response.ok) {
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
          (cleanedResponseText && !cleanedResponseText.startsWith('<')
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

      const flaggedPhrases = normalizeFlaggedPhrases(
        payload.flaggedPhrases,
        transcript === 'No speech detected in clip.' ? '' : transcript
      );

      const normalizedAnalysis: GeminiAudioAnalysis = {
        syntheticProbability,
        acousticObservations,
        detectedLanguage,
        transcript,
        englishTranslation,
        flaggedPhrases,
        scamLanguageScore,
      };

      const fusion = calculateCombinedRisk(
        normalizedAnalysis.syntheticProbability,
        normalizedAnalysis.scamLanguageScore,
        normalizedAnalysis.flaggedPhrases,
        normalizedAnalysis.transcript === 'No speech detected in clip.'
          ? ''
          : normalizedAnalysis.transcript,
        normalizedAnalysis.englishTranslation
      );

      const processingMs = Math.max(
        100,
        Math.round(performance.now() - startedAt)
      );

      const finalResult: FullAnalysisReport = {
        analysis: normalizedAnalysis,
        fusion,
        analyzedAt: new Date().toISOString(),
        clipLabel: clip.label,
        processingMs,
      };

      setErrorMessage(null);
      setReport(finalResult);
      didSucceed = true;
      setAudioClip(null);
      setBufferClearedNotice(true);

      window.setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (didSucceed) {
        try {
          URL.revokeObjectURL(clip.objectUrl);
        } catch {
          // Ignore cleanup errors after report is rendered
        }
      }
      audioBase64 = null;
      analyzingLockRef.current = false;
      setIsAnalyzing(false);
    }
  }

  async function handleAnalyzeClip() {
    if (!audioClip || isAnalyzing || analyzingLockRef.current || !authSession) {
      return;
    }
    await analyzeClipWithToken(audioClip, authSession.token);
  }

  function runLocalDemoScenario(scenarioId: DemoScenario['id']) {
    if (analyzingLockRef.current) return;

    const scenario =
      DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0];
    const preset = DEMO_PRESET_ANALYSES[scenario.id];

    if (audioClip?.objectUrl) {
      try {
        URL.revokeObjectURL(audioClip.objectUrl);
      } catch {
        // Ignore cleanup errors
      }
    }

    const flaggedPhrases = normalizeFlaggedPhrases(
      preset.flaggedPhrases,
      preset.transcript
    );

    const fusion = calculateCombinedRisk(
      preset.syntheticProbability,
      preset.scamLanguageScore,
      flaggedPhrases,
      preset.transcript,
      preset.englishTranslation
    );

    setActiveView('verify');
    setCaptureTab('upload');
    setAudioClip(null);
    setErrorMessage(null);
    setBufferClearedNotice(false);
    setReport({
      analysis: {
        ...preset,
        flaggedPhrases,
      },
      fusion,
      analyzedAt: new Date().toISOString(),
      clipLabel: `Demo Preset · ${scenario.title}`,
      processingMs: 12,
    });

    window.setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
  }

  function handleRunLiveDemoFromHome(scenarioId: DemoScenario['id']) {
    if (!authSession) {
      setPendingAction({ type: 'demo', scenarioId });
      setAuthNotice(
        'Sign in to view this demo scam scenario in the Voice Analyzer.'
      );
      setActiveView('auth');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    runLocalDemoScenario(scenarioId);
  }

  function handleStartLiveRecord() {
    if (!authSession) {
      setPendingAction({ type: 'verify' });
      setAuthNotice('Sign in to record and verify live calls.');
      setActiveView('auth');
      return;
    }
    setActiveView('verify');
    setCaptureTab('record');
    window.setTimeout(() => {
      captureSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        hasActiveSafeWord={Boolean(storedFamilyCircle)}
        username={authSession?.username ?? null}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 min-w-0">
        {activeView === 'home' && (
          <HomePage
            onGoToAnalyzer={() => handleSelectView('verify')}
            onGoToFamilyCircle={() => handleSelectView('family')}
            onRunLiveDemo={handleRunLiveDemoFromHome}
            storedFamilyCircle={storedFamilyCircle}
          />
        )}

        {activeView === 'auth' && (
          <AuthScreen
            onAuthenticated={handleAuthenticated}
            onBackToHome={() => {
              setPendingAction(null);
              setAuthNotice(null);
              setActiveView('home');
            }}
            contextNotice={authNotice}
          />
        )}

        {activeView === 'family' && authSession && (
          <FamilyCircleView
            config={familyCircle}
            onUpdate={handleUpdateFamilyCircle}
            onBackToVerify={() => setActiveView('verify')}
          />
        )}

        {activeView === 'verify' && authSession && (
          <div className="space-y-8 min-w-0">
            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 min-w-0">
              <div className="max-w-3xl min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 break-words text-balance">
                  Voice Analyzer &amp; Scam Script Detector
                </h1>
                <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed break-words">
                  Signed in as{' '}
                  <strong className="text-slate-900">{authSession.username}</strong>.
                  Upload a voice note or record a call clip to check for AI voice cloning and scam pressure tactics.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleStartLiveRecord}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm sm:text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    <span>Record Live Call</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shrink-0 min-w-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Saved Family Circle
                </div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  Safe Word: “{familyCircle.safeWord}”
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-slate-600">
                  <span className="tabular-nums">
                    {familyCircle.contacts.length} trusted{' '}
                    {familyCircle.contacts.length === 1 ? 'contact' : 'contacts'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setActiveView('family')}
                    className="font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
                  >
                    Manage Circle
                  </button>
                </div>
              </div>
            </section>

            <div ref={captureSectionRef}>
              <AudioCaptureCard
                activeTab={captureTab}
                onTabChange={setCaptureTab}
                audioClip={audioClip}
                onClipLoaded={handleClipLoaded}
                onClearClip={handleClearClip}
                onAnalyze={handleAnalyzeClip}
                onRunDemoScenario={runLocalDemoScenario}
                isAnalyzing={isAnalyzing}
                errorMessage={errorMessage}
                onError={setErrorMessage}
                bufferClearedNotice={bufferClearedNotice}
              />
            </div>

            {isAnalyzing && (
              <section
                aria-live="polite"
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-4"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className="w-6 h-6 text-blue-700 animate-pulse"
                    aria-hidden="true"
                  />
                  <h2 className="text-xl font-bold text-slate-900">
                    Running Dual-Signal Voice &amp; Scam Script Verification…
                  </h2>
                </div>
                <p className="text-base text-slate-600">
                  Inspecting vocal prosody, background noise floor, and multilingual speech patterns. Your audio buffer will be deleted immediately once scored.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
                  <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
                </div>
              </section>
            )}

            {!isAnalyzing && report && (
              <div ref={resultsSectionRef} className="space-y-6">
                <RecommendedActionPanel
                  fusion={report.fusion}
                  familyCircle={familyCircle}
                  onOpenFamilyCircle={() => setActiveView('family')}
                />
                <ResultsDashboard report={report} />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200/80 bg-white shrink-0 inline-flex items-center justify-center">
              <img
                src="/logo.png"
                alt="SafeVoice Guard"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top origin-top scale-[1.38]"
              />
            </span>
            <p className="min-w-0 break-words">
              <strong className="font-semibold text-slate-800">
                SafeVoice Guard
              </strong>{' '}
              · AI-assisted verification tool. Acoustic scores are probabilistic; always verify urgent money requests out-of-band.
            </p>
          </div>
          <p className="shrink-0 font-medium text-slate-700">
            Zero audio stored · In-memory scoring only
          </p>
        </div>
      </footer>
    </div>
  );
}
