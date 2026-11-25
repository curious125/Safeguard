import { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldAlert,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { FamilyCircleConfig } from '../types/safevoice';

export interface AuthSessionPayload {
  token: string;
  username: string;
  familyCircle: FamilyCircleConfig;
}

interface AuthScreenProps {
  onAuthenticated: (session: AuthSessionPayload) => void;
  onBackToHome: () => void;
  contextNotice?: string | null;
}

type AuthMode = 'signin' | 'register';

export function AuthScreen({
  onAuthenticated,
  onBackToHome,
  contextNotice,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initialSafeWord, setInitialSafeWord] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 4) {
        setErrorMessage('Password must be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter your password.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const endpoint =
        mode === 'signin' ? '/api/auth/login' : '/api/auth/register';

      const body =
        mode === 'signin'
          ? { username: trimmedUsername, password }
          : {
              username: trimmedUsername,
              password,
              safeWord: initialSafeWord.trim() || undefined,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      const cleanedText = rawText.replace(/```json|```/gi, '').trim();
      if (cleanedText.startsWith('<')) {
        throw new Error(
          'Authentication service returned an HTML response. Please refresh and try again.'
        );
      }

      let payload: (AuthSessionPayload & { error?: string }) | null = null;
      if (cleanedText) {
        try {
          payload = JSON.parse(cleanedText) as AuthSessionPayload & {
            error?: string;
          };
        } catch {
          payload = null;
        }
      }

      if (!response.ok || !payload?.token) {
        throw new Error(
          payload?.error ||
            (mode === 'signin'
              ? 'Incorrect password'
              : 'Could not create account.')
        );
      }

      onAuthenticated({
        token: payload.token,
        username: payload.username,
        familyCircle: payload.familyCircle,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to sign in right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-balance">
            {mode === 'signin'
              ? 'Sign In to Your Saved Account'
              : 'Create Your Family Account'}
          </h1>
          <p className="mt-2 text-base text-slate-600">
            {contextNotice ||
              (mode === 'signin'
                ? 'Enter your username and password to access your saved Family Circle and run voice verification.'
                : 'Save your Family Safe Word and trusted contacts securely behind a password.')}
          </p>
        </div>

        {/* Segmented Mode Switch */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mt-6 grid grid-cols-2 p-1 bg-slate-100 rounded-lg border border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => switchMode('signin')}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm sm:text-base font-semibold transition-colors whitespace-nowrap ${
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" aria-hidden="true" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => switchMode('register')}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm sm:text-base font-semibold transition-colors whitespace-nowrap ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Create Account</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., sharma_family"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-800 rounded-md"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Eye className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-sm font-semibold text-slate-800 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-safe-word"
                  className="block text-sm font-semibold text-slate-800 mb-1.5"
                >
                  Initial Family Safe Word (Optional)
                </label>
                <input
                  id="auth-safe-word"
                  type="text"
                  value={initialSafeWord}
                  onChange={(e) => setInitialSafeWord(e.target.value)}
                  placeholder="Defaults to Mango Orchard"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-sm sm:text-base font-medium text-red-900"
            >
              <ShieldAlert
                className="w-5 h-5 text-red-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>
                  {mode === 'signin' ? 'Signing In…' : 'Creating Account…'}
                </span>
              </>
            ) : (
              <span>
                {mode === 'signin' ? 'Sign In' : 'Create Saved Account'}
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 flex items-start gap-2.5 text-sm text-slate-600">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Passwords are stored salted and hashed on the server. Audio clips are analyzed in memory and never saved.
          </span>
        </div>
      </div>
    </div>
  );
}
