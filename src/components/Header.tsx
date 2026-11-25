import { useState } from 'react';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';

export type ActiveView = 'home' | 'verify' | 'family' | 'auth';

interface HeaderProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  hasActiveSafeWord: boolean;
  username: string | null;
  onSignOut: () => void;
}

export function Header({
  activeView,
  onSelectView,
  hasActiveSafeWord,
  username,
  onSignOut,
}: HeaderProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="md:sticky md:top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2 md:gap-8">
        {/* Zone 1: Brand Logo, Title & Subtle Descriptor */}
        <button
          type="button"
          onClick={() => onSelectView('home')}
          className="flex items-center gap-2.5 text-left min-w-0 min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-md"
        >
          <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shadow-sm border border-slate-200/80 bg-white flex items-center justify-center shrink-0">
            {logoError ? (
              <ShieldCheck className="w-5 h-5 text-blue-700" aria-hidden="true" />
            ) : (
              <img
                src="/logo.png"
                alt="SafeVoice Guard logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover object-top origin-top scale-[1.38]"
              />
            )}
          </span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
            SafeVoice Guard
          </span>
          <span className="hidden lg:inline-block ml-1 pl-3 border-l border-slate-200 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
            Cybersecurity &amp; Digital Trust
          </span>
        </button>

        {/* Zone 3 (Right on desktop, top-right on mobile): Sign In / Sign Out */}
        <div className="flex items-center gap-3 shrink-0 md:order-3">
          {username ? (
            <>
              <span className="hidden xl:inline text-sm font-medium text-slate-600 max-w-[130px] truncate">
                {username}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelectView('auth')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Zone 2: Navigation Tabs (wraps cleanly into full-width touch tabs on mobile) */}
        <nav
          aria-label="Primary navigation"
          className="w-full md:w-auto md:order-2 flex items-center gap-2 sm:gap-5 md:gap-7 overflow-x-auto border-t border-slate-100 md:border-t-0 pt-1.5 md:pt-0 text-sm sm:text-base font-medium"
        >
          <button
            type="button"
            onClick={() => onSelectView('home')}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center min-h-[44px] px-3 md:px-1 py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activeView === 'home'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => onSelectView('verify')}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center min-h-[44px] px-3 md:px-1 py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activeView === 'verify'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Analyze Voice
          </button>

          <button
            type="button"
            onClick={() => onSelectView('family')}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 min-h-[44px] px-3 md:px-1 py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activeView === 'family'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Family Circle</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasActiveSafeWord ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              title={
                hasActiveSafeWord
                  ? 'Family Safe Word active in localStorage'
                  : 'Family Safe Word not yet customized'
              }
              aria-label={
                hasActiveSafeWord
                  ? 'Family Safe Word active'
                  : 'Family Safe Word not configured'
              }
            />
          </button>
        </nav>
      </div>
    </header>
  );
}
