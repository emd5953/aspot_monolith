'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SkyPrompt } from './sky-prompt';
import { AuthPopover } from './auth-popover';

const TEXT_SHADOW_HERO =
  '[text-shadow:0_2px_4px_rgba(10,30,60,0.35),0_8px_32px_rgba(10,30,60,0.45)]';
const TEXT_SHADOW_BODY =
  '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]';

type AuthMode = 'login' | 'signup' | null;

/**
 * Reads the `?verify=1` query param (set by signup) and renders a small
 * confirmation banner. Wrapped in its own component so useSearchParams gets
 * a Suspense boundary in Next 15+.
 */
function VerifyBanner() {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const show = params.get('verify') === '1' && !dismissed;

  // Auto-dismiss after 8 seconds so the landing stays clean.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setDismissed(true), 8000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="animate-fade-up fixed left-1/2 top-24 z-30 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 text-center shadow-[0_24px_60px_-20px_rgba(10,25,55,0.55)] backdrop-blur-md"
      role="status"
    >
      <p className="text-sm font-semibold text-slate-900">Check your inbox</p>
      <p className="mt-1 text-xs text-slate-600">
        We sent a confirmation link. Tap it to finish signing up.
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

  return (
    <>
      <Suspense fallback={null}>
        <VerifyBanner />
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
            <button
              type="button"
              onClick={() =>
                setAuthMode((m) => (m === 'login' ? null : 'login'))
              }
              aria-expanded={authMode === 'login'}
              className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors hover:text-white/90 ${TEXT_SHADOW_BODY}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() =>
                setAuthMode((m) => (m === 'signup' ? null : 'signup'))
              }
              aria-expanded={authMode === 'signup'}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-[0_8px_20px_-8px_rgba(10,25,55,0.5)] transition-all hover:-translate-y-[1px] hover:bg-white/95"
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
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-6 pt-16 pb-32 text-center">
        <div className="flex w-full max-w-xl flex-col items-center">
          <p
            className={`animate-fade-up text-sm font-semibold tracking-wide text-white ${TEXT_SHADOW_BODY}`}
            style={{ animationDelay: '0.05s' }}
          >
            Your pocket travel buddy
          </p>

          <h1
            className={`animate-fade-up mt-5 font-heading text-5xl leading-[1.05] tracking-tight text-white md:text-7xl ${TEXT_SHADOW_HERO}`}
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
