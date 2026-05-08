import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { ItinerarySearch } from '@/components/itinerary/itinerary-search';
import { PromoChip } from '@/components/ui/promo-chip';
import { ArrowRight, ClipboardList, Map, CheckCircle2, AlertCircle } from 'lucide-react';

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
      <AppNav />

      <main className="relative mx-auto max-w-5xl px-6 pt-36 pb-24">
        {/* Hero */}
        <section className="animate-fade-up text-center">
          <PromoChip>Your travel desk</PromoChip>
          <h1 className="mt-6 font-heading text-6xl leading-[0.95] tracking-tight text-[color:var(--ink)] md:text-7xl">
            Welcome back
            {firstName ? (
              <>
                , <span className="italic">{firstName}</span>
              </>
            ) : null}
            .
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-[color:var(--ink-muted)] md:text-lg">
            Where are we going next? Describe a trip, tweak your style, or revisit your plans.
          </p>
        </section>

        {/* Prompt-style search */}
        <section className="animate-fade-up mt-12" style={{ animationDelay: '0.1s' }}>
          <ItinerarySearch />
        </section>

        {/* Quick actions */}
        <section
          className="animate-fade-up mt-10 grid gap-5 md:grid-cols-2"
          style={{ animationDelay: '0.2s' }}
        >
          <HandDrawnCard className="p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                {hasCompletedQuiz ? (
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--accent)]" strokeWidth={2} />
                ) : (
                  <ClipboardList className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[color:var(--ink-muted)]">
                  {hasCompletedQuiz ? 'Complete' : 'Step 1'}
                </p>
                <h3 className="mt-1 font-heading text-2xl text-[color:var(--ink)]">
                  Travel personality quiz
                </h3>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                  {hasCompletedQuiz
                    ? 'Your preferences are saved and shape every itinerary.'
                    : 'A two-minute quiz so aSpot learns how you like to travel.'}
                </p>
                <Link href="/quiz" className="mt-5 inline-block">
                  <HandDrawnButton
                    variant={hasCompletedQuiz ? 'secondary' : 'primary'}
                    size="sm"
                    className="gap-2"
                  >
                    {hasCompletedQuiz ? 'Retake quiz' : 'Start quiz'}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </HandDrawnButton>
                </Link>
              </div>
            </div>
          </HandDrawnCard>

          <HandDrawnCard className="p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                <Map className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[color:var(--ink-muted)]">My itineraries</p>
                <h3 className="mt-1 font-heading text-2xl text-[color:var(--ink)]">
                  Every trip, in one place
                </h3>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                  Review, edit, and manage the trips you&rsquo;ve already planned.
                </p>
                <Link href="/itinerary" className="mt-5 inline-block">
                  <HandDrawnButton variant="secondary" size="sm" className="gap-2">
                    View itineraries
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </HandDrawnButton>
                </Link>
              </div>
            </div>
          </HandDrawnCard>
        </section>

        {!hasCompletedQuiz && (
          <section className="animate-fade-up mt-8" style={{ animationDelay: '0.3s' }}>
            <HandDrawnCard variant="post-it" className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle
                  className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--ink)]"
                  strokeWidth={2}
                />
                <div>
                  <h4 className="font-heading text-xl text-[color:var(--ink)]">
                    Finish your travel profile
                  </h4>
                  <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                    Complete the quiz so every itinerary reflects your pace, budget, and
                    interests from the first plan.
                  </p>
                </div>
              </div>
            </HandDrawnCard>
          </section>
        )}
      </main>
    </div>
  );
}
