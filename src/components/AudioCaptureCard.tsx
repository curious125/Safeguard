import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  FileAudio,
  Loader2,
  Lock,
  Mic,
  Play,
  ShieldAlert,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type { DemoScenario } from '../types/safevoice';
import {
  DEMO_SCENARIOS,
  formatBytes,
  formatDuration,
  normalizeAudioMimeType,
  validateAudioFile,
} from '../utils/audioHelpers';

export interface LoadedAudioClip {
  blob: Blob;
  objectUrl: string;
  label: string;
  mimeType: string;
  sizeBytes: number;
  source: 'upload' | 'recording' | 'demo';
}

export type CaptureTab = 'upload' | 'record';

interface AudioCaptureCardProps {
  activeTab: CaptureTab;
  onTabChange: (tab: CaptureTab) => void;
  audioClip: LoadedAudioClip | null;
  onClipLoaded: (clip: LoadedAudioClip) => void;
  onClearClip: () => void;
  onAnalyze: () => void;
  onRunDemoScenario: (scenarioId: DemoScenario['id']) => void;
  isAnalyzing: boolean;
  errorMessage: string | null;
  onError: (msg: string | null) => void;
  bufferClearedNotice: boolean;
}

export function AudioCaptureCard({
  activeTab,
  onTabChange,
  audioClip,
  onClipLoaded,
  onClearClip,
  onAnalyze,
  onRunDemoScenario,
  isAnalyzing,
  errorMessage,
  onError,
  bufferClearedNotice,
}: AudioCaptureCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(
    () => new Array(20).fill(14)
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const recordingStartTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      stopMediaCleanup();
    };
  }, []);

  function stopMediaCleanup() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  function handleSelectedFile(file: File | undefined) {
    if (!file) return;
    onError(null);
    const validationError = validateAudioFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }
    const mimeType = normalizeAudioMimeType(file);
    const objectUrl = URL.createObjectURL(file);
    onClipLoaded({
      blob: file,
      objectUrl,
      label: file.name,
      mimeType,
      sizeBytes: file.size,
      source: 'upload',
    });
  }

  async function startRecording() {
    onError(null);
    if (audioClip) {
      onClearClip();
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError(
        'Microphone recording is not supported in this browser. Please upload an audio file instead.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const chosenMime = preferredTypes.find(
        (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const elapsedMs = Date.now() - recordingStartTimeRef.current;
        const rawMime = recorder.mimeType || chosenMime || 'audio/webm';
        const cleanMime = normalizeAudioMimeType(rawMime);
        const recordedBlob = new Blob(chunksRef.current, { type: cleanMime });
        chunksRef.current = [];
        stopMediaCleanup();
        setIsRecording(false);
        setWaveformLevels(new Array(20).fill(14));

        if (recordedBlob.size < 1000 || elapsedMs < 500) {
          onError('Recording too short — please speak for at least 2 seconds.');
          return;
        }

        const validationError = validateAudioFile(recordedBlob);
        if (validationError) {
          onError(validationError);
          return;
        }

        const durationLabel = formatDuration(
          Math.max(1, recordingSecondsRef.current)
        );
        const objectUrl = URL.createObjectURL(recordedBlob);
        onClipLoaded({
          blob: recordedBlob,
          objectUrl,
          label: `Live Recording (${durationLabel})`,
          mimeType: cleanMime,
          sizeBytes: recordedBlob.size,
          source: 'recording',
        });
      };

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextCtor) {
        const audioCtx = new AudioContextCtor();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          analyser.getByteFrequencyData(dataArray);
          const bars: number[] = [];
          for (let i = 0; i < 20; i++) {
            const val = dataArray[i % dataArray.length] || 0;
            bars.push(Math.max(12, Math.min(100, Math.round((val / 255) * 100))));
          }
          setWaveformLevels(bars);
          animFrameRef.current = window.requestAnimationFrame(updateBars);
        };
        updateBars();
      }

      recordingSecondsRef.current = 0;
      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= 90) {
          stopRecording();
        }
      }, 1000);
    } catch {
      stopMediaCleanup();
      setIsRecording(false);
      onError(
        'Microphone access was denied or unavailable. Allow microphone permission or upload a call recording.'
      );
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    } else {
      stopMediaCleanup();
      setIsRecording(false);
    }
  }

  function handleSpeakPreview(scenario: DemoScenario) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      scenario.scriptPreview.replace(/^"|"$/g, '')
    );
    utterance.rate = scenario.id === 'safe-checkin' ? 0.98 : 1.08;
    window.speechSynthesis.speak(utterance);
  }

  const isRateLimitError = Boolean(
    errorMessage &&
      (errorMessage.toLowerCase().includes('high traffic') ||
        errorMessage.toLowerCase().includes('wait 15 seconds'))
  );

  return (
    <section
      aria-labelledby="capture-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-xs min-w-0"
    >
      {/* Privacy Guarantee Header Line */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200 min-w-0">
        <div className="min-w-0">
          <h2
            id="capture-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 break-words"
          >
            Check a Suspicious Call or Voice Note
          </h2>
          <p className="text-base text-slate-600 mt-1 break-words">
            Upload a call recording, record live audio, or load a test scenario below.
          </p>
        </div>

        <div className="flex items-start sm:items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 min-w-0 lg:shrink-0">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            Audio processed in memory &amp; deleted immediately after scoring.
          </span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div
          role="tablist"
          aria-label="Audio input method"
          className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 w-full sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upload'}
            disabled={isRecording || isAnalyzing}
            onClick={() => {
              if (!isRecording && !isAnalyzing) onTabChange('upload');
            }}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md text-sm sm:text-base font-semibold transition-colors whitespace-nowrap disabled:opacity-60 ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Upload Audio</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'record'}
            disabled={isAnalyzing}
            onClick={() => {
              if (!isAnalyzing) onTabChange('record');
            }}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md text-sm sm:text-base font-semibold transition-colors whitespace-nowrap disabled:opacity-60 ${
              activeTab === 'record'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Record Live Clip</span>
          </button>
        </div>

        <span className="text-sm text-slate-500">
          Supports WAV, MP3, M4A, AAC, WebM, OGG · Max 10 MB
        </span>
      </div>

      {/* Input Area */}
      <div className="mt-5">
        {activeTab === 'upload' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isAnalyzing) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (!isAnalyzing) handleSelectedFile(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-5 sm:p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.aac,.webm,.ogg,audio/*"
              disabled={isAnalyzing}
              onChange={(e) => handleSelectedFile(e.target.files?.[0])}
              className="sr-only"
              id="audio-file-upload"
            />
            <div className="mx-auto w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 mb-3">
              <FileAudio className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-base sm:text-lg font-semibold text-slate-900">
              Drop a call recording or voicemail here
            </p>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Works with WhatsApp voice notes, phone call recordings, or voicemails.
            </p>
            <div className="mt-5">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Choose Audio File</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3">
                  {isRecording && (
                    <span
                      className="w-3 h-3 rounded-full bg-red-600 animate-pulse shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-lg font-semibold text-slate-900">
                    {isRecording
                      ? 'Recording Live Audio…'
                      : 'Hold Speakerphone Near Microphone'}
                  </span>
                </div>
                <p className="text-base text-slate-600">
                  {isRecording
                    ? 'Capture 5–15 seconds of the caller speaking, then press Stop.'
                    : 'Put a suspicious call on speakerphone and record a short clip to verify.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shrink-0">
                <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 sm:min-w-[5.5rem] sm:text-right">
                  {formatDuration(recordingSeconds)}
                </span>
                {!isRecording ? (
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={startRecording}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-base font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    <Mic className="w-5 h-5" aria-hidden="true" />
                    <span>Start Recording</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Stop Recording</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Waveform Bars */}
            <div
              aria-hidden="true"
              className="mt-6 h-14 px-4 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-1 sm:gap-1.5"
            >
              {waveformLevels.map((level, idx) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-sm transition-all duration-100 ${
                    isRecording ? 'bg-red-600' : 'bg-slate-200'
                  }`}
                  style={{ height: `${level}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Audio Player & Primary Analyze Action */}
      {audioClip && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <p
                className="text-base font-semibold text-slate-900 truncate"
                title={audioClip.label}
              >
                {audioClip.label}
              </p>
              <p className="text-sm text-slate-600 mt-0.5 tabular-nums break-words">
                {audioClip.mimeType} · {formatBytes(audioClip.sizeBytes)} · Ready in memory
              </p>
            </div>
            <button
              type="button"
              onClick={onClearClip}
              disabled={isAnalyzing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 hover:text-red-700 bg-white border border-slate-200 rounded-lg transition-colors shrink-0 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Remove Clip</span>
            </button>
          </div>

          <div className="mt-4 flex flex-col lg:flex-row lg:items-center gap-4 min-w-0">
            <audio
              controls
              src={audioClip.objectUrl}
              className="w-full min-w-0 h-12"
              aria-label="Loaded audio clip playback"
            />
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              aria-busy={isAnalyzing}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 min-h-[48px] rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-base font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Analyzing Clip…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Analyze Clip</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Memory Cleared Notice after scoring */}
      {!audioClip && bufferClearedNotice && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 flex items-start sm:items-center gap-2.5 text-sm sm:text-base text-emerald-900">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="break-words">
            Scoring complete — the audio buffer and temporary URL were deleted from memory immediately.
          </span>
        </div>
      )}

      {/* Inline Error / Rate-Limit Banner */}
      {errorMessage && (
        <div
          role="alert"
          className={`mt-5 rounded-lg border px-4 py-3.5 flex items-start gap-3 text-base min-w-0 ${
            isRateLimitError
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {isRateLimitError ? (
            <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span className="min-w-0 break-words font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Load Hackathon Demo Clips Bar */}
      <div className="mt-7 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Load Hackathon Demo Clips
          </h3>
          <span className="text-sm text-slate-600">
            Instant pre-computed scam &amp; voice analysis — zero API quota used
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEMO_SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 gap-3 min-w-0"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-600">
                  {scenario.shortLabel}
                </div>
                <div className="text-base font-bold text-slate-900 mt-1 break-words">
                  {scenario.title}
                </div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed break-words">
                  {scenario.scriptPreview}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onRunDemoScenario(scenario.id)}
                  disabled={isAnalyzing}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-sm font-semibold text-slate-900 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Run Demo Result</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeakPreview(scenario)}
                  title="Speak preview using browser speech"
                  aria-label={`Speak preview for ${scenario.title}`}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition-colors shrink-0"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
