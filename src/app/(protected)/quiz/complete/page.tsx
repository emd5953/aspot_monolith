import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserPreferences } from '@/lib/quiz/profile-generator';
import { clearProgress } from '@/lib/quiz/progress-service';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { PromoChip } from '@/components/ui/promo-chip';

const TEXT_SHADOW =
  '[text-shadow:0_2px_6px_rgba(10,30,60,0.6),0_8px_32px_rgba(10,30,60,0.5)]';
const TEXT_SHADOW_SM =
  '[text-shadow:0_1px_4px_rgba(10,30,60,0.6),0_4px_18px_rgba(10,30,60,0.5)]';

export default async function QuizCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const preferences = await getUserPreferences(supabase, user.id);
  if (!preferences) redirect('/quiz');

  await clearProgress(supabase, user.id);

  return (
    <main className="relative mx-auto max-w-2xl px-6 pt-16 pb-24">
      <section className="animate-fade-up text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/50 bg-white/20 backdrop-blur-md">
          <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2} />
        </div>
        <PromoChip>All set</PromoChip>
        <h1 className={`mt-5 font-heading text-5xl leading-[0.95] text-white md:text-6xl ${TEXT_SHADOW}`}>
          Your travel <span className="italic">profile</span> is ready.
        </h1>
        <p className={`mx-auto mt-5 max-w-md text-base font-medium text-white ${TEXT_SHADOW_SM}`}>
          We&rsquo;ve saved your preferences. Every itinerary we build will be tuned to how
          you travel.
        </p>
      </section>

      <HandDrawnCard className="animate-fade-up mt-10 p-7" style={{ animationDelay: '0.15s' }}>
        <p className="mb-5 text-sm font-medium text-[color:var(--ink-muted)]">
          Your preferences
        </p>
        <dl className="space-y-3.5">
          <Row label="Planning style" value={preferences.planningStyle?.replace(/_/g, ' ')} />
          <Row label="Budget" value={preferences.budgetRange} />
          <Row label="Travel pace" value={preferences.travelPace} />
          <Row label="Comfort zone" value={`${preferences.comfortZone}/10`} />
          {preferences.cuisinePreferences.length > 0 && (
            <Row label="Cuisines" value={preferences.cuisinePreferences.join(', ')} />
          )}
          {preferences.activityTypes.length > 0 && (
            <Row label="Activities" value={preferences.activityTypes.join(', ')} />
          )}
        </dl>
      </HandDrawnCard>

      <div
        className="animate-fade-up mt-8 flex flex-col justify-center gap-3 sm:flex-row"
        style={{ animationDelay: '0.25s' }}
      >
        <Link href="/dashboard">
          <HandDrawnButton variant="primary" size="md" className="gap-2">
            Go to dashboard
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </HandDrawnButton>
        </Link>
        <Link href="/profile/edit">
          <HandDrawnButton variant="secondary" size="md">
            Tweak preferences
          </HandDrawnButton>
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-[color:var(--ink-muted)]">{label}</dt>
      <dd className="text-right font-heading text-xl capitalize text-[color:var(--ink)]">
        {value}
      </dd>
    </div>
  );
}
