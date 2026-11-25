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
import { blobToBase64, DEMO_SCENARIOS } from './utils/audioHelpers';
import {
  clearFamilyCircleStorage,
  DEFAULT_FAMILY_CIRCLE,
  readFamilyCircleFromStorage,
  saveFamilyCircle,
} from './utils/familyCircle';
import { calculateCombinedRisk } from './utils/riskFusion';

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
      await executeLiveDemoWithToken(action.scenarioId, session.token);
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
    setIsAnalyzing(true);
    setErrorMessage(null);
    setBufferClearedNotice(false);

    const startedAt = performance.now();
    let audioBase64: string | null = null;

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

      const payload = (await response.json().catch(() => null)) as
        | (GeminiAudioAnalysis & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(
          payload?.error ||
            'Audio verification failed. Please check your connection and try again.'
        );
      }

      const fusion = calculateCombinedRisk(
        payload.syntheticProbability,
        payload.scamLanguageScore,
        payload.flaggedPhrases,
        payload.transcript,
        payload.englishTranslation
      );

      const processingMs = Math.max(
        100,
        Math.round(performance.now() - startedAt)
      );

      setReport({
        analysis: payload,
        fusion,
        analyzedAt: new Date().toISOString(),
        clipLabel: clip.label,
        processingMs,
      });

      URL.revokeObjectURL(clip.objectUrl);
      setAudioClip(null);
      setBufferClearedNotice(true);

      window.setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to analyze this audio clip right now.'
      );
    } finally {
      audioBase64 = null;
      setIsAnalyzing(false);
    }
  }

  async function handleAnalyzeClip() {
    if (!audioClip || isAnalyzing || !authSession) return;
    await analyzeClipWithToken(audioClip, authSession.token);
  }

  async function executeLiveDemoWithToken(
    scenarioId: DemoScenario['id'],
    token: string
  ) {
    const scenario =
      DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0];

    setActiveView('verify');
    setCaptureTab('upload');
    setErrorMessage(null);
    setReport(null);
    setIsAnalyzing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await fetch(`/api/demo-clip/${scenario.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await handleSignOut();
        return;
      }

      if (!response.ok) {
        const errPayload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          errPayload?.error || 'Could not load the demo audio clip.'
        );
      }

      const wavBlob = await response.blob();
      const objectUrl = URL.createObjectURL(wavBlob);
      const demoClip: LoadedAudioClip = {
        blob: wavBlob,
        objectUrl,
        label: `Demo · ${scenario.title}`,
        mimeType: 'audio/wav',
        sizeBytes: wavBlob.size,
        source: 'demo',
      };

      handleClipLoaded(demoClip);
      await analyzeClipWithToken(demoClip, token);
    } catch (err) {
      setIsAnalyzing(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to run the live demo scenario right now.'
      );
    }
  }

  function handleRunLiveDemoFromHome(scenarioId: DemoScenario['id']) {
    if (!authSession) {
      setPendingAction({ type: 'demo', scenarioId });
      setAuthNotice(
        'Sign in to load this spoken scenario and run live Gemini voice analysis.'
      );
      setActiveView('auth');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    void executeLiveDemoWithToken(scenarioId, authSession.token);
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        hasActiveSafeWord={Boolean(storedFamilyCircle)}
        username={authSession?.username ?? null}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
          <div className="space-y-8">
            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-3xl">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
                  Voice Analyzer &amp; Scam Script Detector
                </h1>
                <p className="mt-3 text-lg text-slate-600 leading-relaxed">
                  Signed in as{' '}
                  <strong className="text-slate-900">{authSession.username}</strong>.
                  Upload a voice note or record a call clip to check for AI voice cloning and scam pressure tactics.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleStartLiveRecord}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm sm:text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    <span>Record Live Call</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shrink-0">
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
                authToken={authSession.token}
                activeTab={captureTab}
                onTabChange={setCaptureTab}
                audioClip={audioClip}
                onClipLoaded={handleClipLoaded}
                onClearClip={handleClearClip}
                onAnalyze={handleAnalyzeClip}
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
          <p>
            AI-assisted verification tool. Acoustic scores are probabilistic; always verify urgent money requests out-of-band.
          </p>
          <p className="shrink-0 font-medium text-slate-700">
            Zero audio stored · In-memory scoring only
          </p>
        </div>
      </footer>
    </div>
  );
}
