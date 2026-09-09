'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SkyPrompt } from './sky-prompt';
import { AuthPopover } from './auth-popover';

type AuthMode = 'login' | 'signup' | null;

/**
 * Reads landing query params and renders a small banner:
 *   - `?verify=1`     → signup confirmation ("check your inbox")
 *   - `?authError=1`  → the auth callback couldn't sign the user in
 *                       (expired/invalid email link or failed OAuth)
 * Wrapped in its own component so useSearchParams gets a Suspense boundary in
 * Next 15+.
 */
function HeroBanner() {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const kind = params.get('verify') === '1'
    ? 'verify'
    : params.get('authError') === '1'
      ? 'authError'
      : null;
  const show = kind !== null && !dismissed;

  // Auto-dismiss after 8 seconds so the landing stays clean.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setDismissed(true), 8000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  const isError = kind === 'authError';

  return (
    <div
      className="animate-fade-up fixed left-1/2 top-24 z-30 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 text-center shadow-[0_24px_60px_-20px_rgba(10,25,55,0.55)] backdrop-blur-md"
      role={isError ? 'alert' : 'status'}
    >
      <p className={`text-sm font-semibold ${isError ? 'text-rose-700' : 'text-slate-900'}`}>
        {isError ? "We couldn't sign you in" : 'Check your inbox'}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {isError
          ? 'That sign-in link may have expired. Tap Log in to try again.'
          : 'We sent a confirmation link. Tap it to finish signing up.'}
      </p>
    </div>
  );
}

/**
 * Landing hero with auth popover anchored under the nav.
 * Clicking "Log in" / "Sign up" opens a small transparent-ish popover;
 * outside clicks or Escape dismiss it.
 */
export function LandingHero() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // The white "cloud" pill is a single shared element that slides between the
  // Log in / Sign up buttons. It rests on Sign up by default (the primary CTA)
  // and glides over to Log in when login mode is active.
  const loginRef = useRef<HTMLButtonElement>(null);
  const signupRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = authMode === 'login' ? loginRef.current : signupRef.current;
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    // Re-measure on resize and once webfonts settle (button widths shift).
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [authMode]);

  return (
    <>
      <Suspense fallback={null}>
        <HeroBanner />
      </Suspense>

      {/* Top nav */}
      <header className="relative z-20 px-6 pt-6 md:px-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setAuthMode(null)}
            aria-label="Spotz home"
            className="font-heading text-2xl leading-none text-white"
          >
            Spotz
          </button>

          {/* Anchor: position relative so the popover can absolutely-position under it */}
          <div className="relative flex items-center gap-1 sm:gap-2">
            {/* Shared white pill that glides between the two buttons. */}
            {pill && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 h-full rounded-full bg-white shadow-[0_8px_20px_-8px_rgba(10,25,55,0.5)] transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ left: pill.left, width: pill.width }}
              />
            )}
            <button
              ref={loginRef}
              type="button"
              onClick={() =>
                setAuthMode((m) => (m === 'login' ? null : 'login'))
              }
              aria-expanded={authMode === 'login'}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                authMode === 'login'
                  ? 'text-slate-900'
                  : 'text-white'
              }`}
            >
              Log in
            </button>
            <button
              ref={signupRef}
              type="button"
              onClick={() =>
                setAuthMode((m) => (m === 'signup' ? null : 'signup'))
              }
              aria-expanded={authMode === 'signup'}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                authMode === 'login'
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              Sign up
            </button>

            {authMode && (
              <AuthPopover
                mode={authMode}
                onClose={() => setAuthMode(null)}
                onSwitchMode={(next) => setAuthMode(next)}
              />
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-88px)] flex-col items-center justify-center px-5 pt-16 pb-32 sm:px-6 text-center">
        <div className="flex w-full max-w-xl flex-col items-center">
          <h1
            className={`animate-fade-up font-heading text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl`}
            style={{ animationDelay: '0.15s' }}
          >
            Yurrrrr,
            <br />
            what&rsquo;s the word?
          </h1>

          <p
            className="animate-fade-up mt-5 text-base font-medium text-white"
            style={{ animationDelay: '0.15s' }}
          >
            Parties, popups, food. Tonight.
          </p>

          <div
            className="animate-fade-up mt-8 w-full"
            style={{ animationDelay: '0.25s' }}
          >
            <SkyPrompt
              onSubmit={(prompt) => {
                // Stash the prompt so the signup flow can seed the first
                // itinerary once the user is authed.
                try {
                  sessionStorage.setItem('spotz:pending-prompt', prompt);
                } catch {
                  /* sessionStorage may be unavailable (private mode) */
                }
                setAuthMode('login');
              }}
            />
          </div>
        </div>
      </main>
    </>
  );
}
