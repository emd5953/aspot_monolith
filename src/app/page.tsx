import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CoverVideo } from '@/components/landing/cover-video';
import { SkyPrompt } from '@/components/landing/sky-prompt';

// Force dynamic rendering — don't cache this page.
export const dynamic = 'force-dynamic';

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

      {/* Nav */}
      <header className="relative z-10 px-6 pt-6 md:px-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            aria-label="aSpot home"
            className="font-heading text-2xl leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
          >
            aSpot
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm text-white/90 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-900 transition-all hover:bg-white hover:-translate-y-[1px]"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-4xl flex-col items-center justify-center px-6 pb-28 text-center">
        <p
          className="animate-fade-up text-sm font-medium text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          style={{ animationDelay: '0.05s' }}
        >
          Your pocket travel buddy
        </p>

        <h1
          className="animate-fade-up mt-5 font-heading text-5xl leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.3)] md:text-7xl"
          style={{ animationDelay: '0.15s' }}
        >
          Where are we
          <br />
          <span className="italic">going next?</span>
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-md text-base leading-relaxed text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)] md:text-lg"
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
          className="animate-fade-up mt-5 text-sm text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          style={{ animationDelay: '0.5s' }}
        >
          No credit card. Just a daydream.{' '}
          <Link
            href="/signup"
            className="underline decoration-white/50 decoration-1 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
          >
            Start free
          </Link>
        </p>
      </main>
    </div>
  );
}
