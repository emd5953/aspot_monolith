import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CoverVideo } from '@/components/landing/cover-video';
import { LandingHero } from '@/components/landing/landing-hero';

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

      {/* Soft radial scrim centered on the hero text so copy stays legible */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 45% at 50% 55%, rgba(10,25,55,0.35) 0%, rgba(10,25,55,0.12) 55%, transparent 80%)',
        }}
      />

      <LandingHero />
    </div>
  );
}
