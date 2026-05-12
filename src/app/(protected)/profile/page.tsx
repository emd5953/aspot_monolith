import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getPreferences } from '@/lib/preferences/preferences-service';
import { getArchetype } from '@/lib/preferences/archetype';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

// Human-readable labels for the raw preference values stored in the DB.
const LABELS: Record<string, Record<string, string>> = {
  planningStyle: {
    hyper_planner: 'Plans every minute',
    structured_flexible: 'Loose plan, room to roam',
    loose_framework: 'Just a few anchors',
    pure_spontaneous: 'Pure improv',
  },
  authenticityPreference: {
    authentic_local: 'Off the tourist trail',
    balanced: 'Mix of both',
    popular_spots: 'The classics',
  },
  timeRhythm: {
    early_bird: 'Up with the sun',
    steady_daytime: 'Daytime steady',
    afternoon_evening: 'Afternoons and evenings',
    night_owl: 'A night person',
  },
  budgetRange: {
    budget: 'Budget-friendly',
    moderate: 'Mid-range',
    luxury: 'Luxury',
  },
  travelPace: {
    relaxed: 'Relaxed',
    moderate: 'Balanced',
    packed: 'Action-packed',
  },
  socialPreferences: {
    solo: 'Solo',
    couple: 'With a partner',
    small_group: 'Small group',
    large_group: 'Large group',
  },
};

const TAG_LABELS: Record<string, string> = {
  // motivations
  adventure: 'Adventure',
  culture: 'Culture',
  food: 'Food',
  relaxation: 'Relaxation',
  nature: 'Nature',
  nightlife: 'Nightlife',
  shopping: 'Shopping',
  history: 'History',
  photography: 'Photography',
  wellness: 'Wellness',
  // activities
  hiking: 'Hiking',
  museums: 'Museums',
  beaches: 'Beaches',
  sports: 'Sports',
  concerts: 'Concerts',
  cooking: 'Cooking',
  yoga: 'Yoga',
  diving: 'Diving',
  // cuisines
  italian: 'Italian',
  japanese: 'Japanese',
  mexican: 'Mexican',
  french: 'French',
  thai: 'Thai',
  indian: 'Indian',
  mediterranean: 'Mediterranean',
  korean: 'Korean',
  vietnamese: 'Vietnamese',
  american: 'American',
  street_food: 'Street food',
  fine_dining: 'Fine dining',
};

const prettify = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const preferences = await getPreferences(supabase, user.id);
  if (!preferences) redirect('/quiz');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single();

  const displayName = profile?.display_name || 'Traveler';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const archetype = getArchetype(preferences);

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        {/* Passport-style hero */}
        <HandDrawnCard className="animate-fade-up overflow-hidden p-0">
          {/* Top band — archetype banner */}
          <div className="relative bg-gradient-to-br from-[color:var(--sky-top)] via-white to-[color:var(--sky-mid)] px-8 pt-8 pb-7">
            <p className="text-sm font-medium text-[color:var(--ink-muted)]">
              Travel passport
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-4xl leading-none">{archetype.emoji}</span>
              <h1 className="font-heading text-4xl leading-[1.05] text-[color:var(--ink)] md:text-5xl">
                {archetype.title}
              </h1>
            </div>
            <p className="mt-3 max-w-lg text-base italic text-[color:var(--ink-muted)]">
              {archetype.bio}
            </p>
          </div>

          {/* Identity row */}
          <div className="flex flex-wrap items-center justify-between gap-5 border-y border-[color:var(--border)] px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-white font-heading text-2xl text-[color:var(--ink)]">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-2xl text-[color:var(--ink)]">
                  {displayName}
                </h2>
                {profile?.username && (
                  <p className="text-sm text-[color:var(--ink-muted)]">
                    @{profile.username}
                  </p>
                )}
              </div>
            </div>

            <Link href="/profile/edit">
              <HandDrawnButton variant="secondary" size="sm" className="gap-2">
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                Edit
              </HandDrawnButton>
            </Link>
          </div>

          {/* Traits grid */}
          <div className="grid gap-0 divide-y divide-[color:var(--border)] md:grid-cols-2 md:divide-y-0 md:divide-x">
            <TraitCell
              label="Planning style"
              value={LABELS.planningStyle[preferences.planningStyle] ?? prettify(preferences.planningStyle)}
            />
            <TraitCell
              label="Authenticity"
              value={
                LABELS.authenticityPreference[preferences.authenticityPreference] ??
                prettify(preferences.authenticityPreference)
              }
            />
          </div>
          <div className="grid gap-0 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)] md:grid-cols-3 md:divide-y-0 md:divide-x">
            <TraitCell
              label="Pace"
              value={LABELS.travelPace[preferences.travelPace] ?? prettify(preferences.travelPace)}
            />
            <TraitCell
              label="Budget"
              value={LABELS.budgetRange[preferences.budgetRange] ?? prettify(preferences.budgetRange)}
            />
            <TraitCell
              label="Travels with"
              value={
                LABELS.socialPreferences[preferences.socialPreferences] ??
                prettify(preferences.socialPreferences)
              }
            />
          </div>

          {/* Comfort-zone meter */}
          <div className="border-t border-[color:var(--border)] px-8 py-6">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-[color:var(--ink-muted)]">
                Comfort zone
              </p>
              <p className="font-heading text-lg text-[color:var(--ink)]">
                {preferences.comfortZone}
                <span className="text-[color:var(--ink-soft)]"> / 10</span>
              </p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[color:var(--accent)]"
                style={{ width: `${preferences.comfortZone * 10}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[color:var(--ink-soft)]">
              <span>Familiar &amp; comfortable</span>
              <span>Bring on the unknown</span>
            </div>
          </div>
        </HandDrawnCard>

        {/* Tag collections */}
        <section
          className="animate-fade-up mt-5 grid gap-5 md:grid-cols-3"
          style={{ animationDelay: '0.1s' }}
        >
          <TagPanel
            title="Motivated by"
            items={preferences.travelMotivations}
            empty="Nothing chosen yet"
          />
          <TagPanel
            title="Loves"
            items={preferences.activityTypes}
            empty="No activities yet"
          />
          <TagPanel
            title="Eats"
            items={preferences.cuisinePreferences}
            empty="No cuisines yet"
          />
        </section>

        {/* Footer actions */}
        <div
          className="animate-fade-up mt-8 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: '0.15s' }}
        >
          <Link href="/profile/edit">
            <HandDrawnButton variant="primary" size="md" className="gap-2">
              Tweak preferences
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </HandDrawnButton>
          </Link>
          <Link href="/quiz">
            <HandDrawnButton variant="secondary" size="md">
              Retake quiz
            </HandDrawnButton>
          </Link>
        </div>
      </main>
    </div>
  );
}

function TraitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-8 py-5">
      <p className="text-xs font-medium text-[color:var(--ink-soft)]">{label}</p>
      <p className="mt-1 font-heading text-xl text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function TagPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <HandDrawnCard className="p-5">
      <p className="text-sm font-medium text-[color:var(--ink-muted)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-sm italic text-[color:var(--ink-soft)]">{empty}</span>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1 text-xs text-[color:var(--ink)]"
            >
              {TAG_LABELS[item] ?? prettify(item)}
            </span>
          ))
        )}
      </div>
    </HandDrawnCard>
  );
}
