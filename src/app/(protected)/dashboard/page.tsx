import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppNav } from '@/components/layout/app-nav';
import { ItinerarySearch } from '@/components/itinerary/itinerary-search';
import { CoverVideo } from '@/components/landing/cover-video';
import { FloatingHint } from '@/components/dashboard/floating-hint';

// Matches the text-shadow stack on the landing hero so the two screens read
// as a continuous experience.
const TEXT_SHADOW_HERO =
  '[text-shadow:0_2px_4px_rgba(10,30,60,0.35),0_8px_32px_rgba(10,30,60,0.45)]';
const TEXT_SHADOW_BODY =
  '[text-shadow:0_1px_3px_rgba(10,30,60,0.45),0_4px_16px_rgba(10,30,60,0.35)]';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const hasCompletedQuiz = !!preferences;
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <div className="relative min-h-screen">
      {/* Hero section with full-bleed video background */}
      <section className="relative min-h-screen overflow-hidden text-white">
        <CoverVideo
          src="/cover2.mp4"
          poster="/cover2-poster.jpg"
          vignette={0.35}
        />

        {/* Soft radial scrim centered on the hero text so copy stays legible */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden
          style={{
            background:
              'radial-gradient(60% 45% at 50% 55%, rgba(10,25,55,0.38) 0%, rgba(10,25,55,0.15) 55%, transparent 80%)',
          }}
        />

        <div className="relative z-10">
          <AppNav tone="light" />
        </div>

        {/* Floating hint bubbles — appear out of the clouds */}
        <FloatingHint
          position={{ top: '26%', left: '11%' }}
          rotate={-2}
          appearDelay={1200}
          expandAfter={1600}
          message={
            hasCompletedQuiz
              ? 'Want to update your travel personality?'
              : 'Psst… want a quick personality quiz so I plan smarter?'
          }
          cta={hasCompletedQuiz ? 'Retake the quiz' : 'Take the quiz'}
          href="/quiz"
        />

        <FloatingHint
          position={{ bottom: '22%', right: '9%' }}
          rotate={2}
          appearDelay={2200}
          expandAfter={1800}
          message="Peek at the trips you've already dreamed up."
          cta="Open my itineraries"
          href="/itinerary"
        />

        <div className="pointer-events-none relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-6 pt-16 pb-32 text-center">
          <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center">
            <p
              className={`animate-fade-up text-sm font-semibold tracking-wide text-white ${TEXT_SHADOW_BODY}`}
              style={{ animationDelay: '0.05s' }}
            >
              Your travel desk
            </p>

            <h1
              className={`animate-fade-up mt-5 font-heading text-5xl leading-[1.05] tracking-tight text-white md:text-7xl ${TEXT_SHADOW_HERO}`}
              style={{ animationDelay: '0.15s' }}
            >
              Welcome back
              {firstName ? (
                <>
                  ,<br />
                  <span className="italic">{firstName}</span>.
                </>
              ) : (
                '.'
              )}
            </h1>

            <p
              className={`animate-fade-up mt-6 text-base font-medium leading-relaxed text-white md:text-lg ${TEXT_SHADOW_BODY}`}
              style={{ animationDelay: '0.25s' }}
            >
              Where are we going next? Describe a trip, tweak your style, or
              revisit your plans.
            </p>

            <div
              className="animate-fade-up mt-10 w-full"
              style={{ animationDelay: '0.35s' }}
            >
              <ItinerarySearch tone="light" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
