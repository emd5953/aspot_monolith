import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ItinerarySearch } from '@/components/itinerary/itinerary-search';
import { FloatingHint } from '@/components/dashboard/floating-hint';

// Text-shadow stack shared with the landing hero so copy stays readable on
// the sky video behind.
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
    redirect('/');
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
    <>
      {/* Floating hint bubbles — drift out of the clouds */}
      <div className="pointer-events-none fixed inset-0 z-20">
        <FloatingHint
          position={{ top: '24%', left: '11%' }}
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
          position={{ bottom: '20%', right: '9%' }}
          rotate={2}
          appearDelay={2200}
          expandAfter={1800}
          message="Peek at the trips you've already dreamed up."
          cta="Open my itineraries"
          href="/itinerary"
        />
      </div>

      <main className="pointer-events-none fixed inset-0 z-10 mx-auto flex flex-col items-center justify-center overflow-hidden px-6 text-center">
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
      </main>
    </>
  );
}
