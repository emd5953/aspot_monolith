'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SkyPrompt } from './sky-prompt';
import { AuthPopover } from './auth-popover';

const TEXT_SHADOW_HERO =
  '[text-shadow:0_2px_4px_rgba(10,30,60,0.35),0_8px_32px_rgba(10,30,60,0.45)]';
const TEXT_SHADOW_BODY =
  '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]';

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
            aria-label="aSpot home"
            className={`font-heading text-2xl leading-none text-white ${TEXT_SHADOW_BODY}`}
          >
            aSpot
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
                  : `text-white ${TEXT_SHADOW_BODY}`
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
                  ? `text-white ${TEXT_SHADOW_BODY}`
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
          <p
            className={`animate-fade-up text-sm font-semibold tracking-wide text-white ${TEXT_SHADOW_BODY}`}
            style={{ animationDelay: '0.05s' }}
          >
            Your pocket travel buddy
          </p>

          <h1
            className={`animate-fade-up mt-5 font-heading text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl ${TEXT_SHADOW_HERO}`}
            style={{ animationDelay: '0.15s' }}
          >
            Where are we
            <br />
            <span className="italic">going next?</span>
          </h1>

          <p
            className={`animate-fade-up mt-6 text-base font-medium leading-relaxed text-white md:text-lg ${TEXT_SHADOW_BODY}`}
            style={{ animationDelay: '0.25s' }}
          >
            Tell us the vibe. We&rsquo;ll sketch the days, find the spots, and
            leave room for wandering.
          </p>

          <div
            className="animate-fade-up mt-10 w-full"
            style={{ animationDelay: '0.35s' }}
          >
            <SkyPrompt
              onSubmit={(prompt) => {
                // Stash the prompt so the signup flow can seed the first
                // itinerary once the user is authed.
                try {
                  sessionStorage.setItem('aspot:pending-prompt', prompt);
                } catch {
                  /* sessionStorage may be unavailable (private mode) */
                }
                setAuthMode('login');
              }}
            />
          </div>

          <p
            className={`animate-fade-up mt-5 text-sm font-medium text-white ${TEXT_SHADOW_BODY}`}
            style={{ animationDelay: '0.5s' }}
          >
            No credit card. Just a daydream.{' '}
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className="underline decoration-white/70 decoration-1 underline-offset-4 transition-colors hover:decoration-white"
            >
              Start free
            </button>
          </p>
        </div>
      </main>
    </>
  );
}
