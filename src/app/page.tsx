import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CoverVideo } from '@/components/landing/cover-video';
import { SkyPrompt } from '@/components/landing/sky-prompt';

// Force dynamic rendering — don't cache this page.
export const dynamic = 'force-dynamic';

// Stacked soft shadows keep white text readable on the sky without a heavy
// vignette. Tuned for Instrument Serif (thin) + small label copy.
const TEXT_SHADOW_HERO =
  '[text-shadow:0_2px_4px_rgba(10,30,60,0.35),0_8px_32px_rgba(10,30,60,0.45)]';
const TEXT_SHADOW_BODY =
  '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <CoverVideo />

      {/* Soft radial scrim centered on the hero text so copy stays legible */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 45% at 50% 55%, rgba(10,25,55,0.35) 0%, rgba(10,25,55,0.12) 55%, transparent 80%)',
        }}
      />

      {/* Nav */}
      <header className="relative z-10 px-6 pt-6 md:px-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            aria-label="aSpot home"
            className={`font-heading text-2xl leading-none text-white ${TEXT_SHADOW_BODY}`}
          >
            aSpot
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors hover:text-white/90 ${TEXT_SHADOW_BODY}`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-[0_8px_20px_-8px_rgba(10,25,55,0.5)] transition-all hover:-translate-y-[1px] hover:bg-white/95"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero — centered, nudged slightly above the midline */}
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
            <SkyPrompt />
          </div>

          <p
            className={`animate-fade-up mt-5 text-sm font-medium text-white ${TEXT_SHADOW_BODY}`}
            style={{ animationDelay: '0.5s' }}
          >
            No credit card. Just a daydream.{' '}
            <Link
              href="/signup"
              className="underline decoration-white/70 decoration-1 underline-offset-4 transition-colors hover:decoration-white"
            >
              Start free
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
