import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getPreferences } from '@/lib/preferences/preferences-service';
import { getArchetype } from '@/lib/preferences/archetype';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

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
    <main className="relative mx-auto max-w-3xl px-6 pt-16 pb-24">
      {/* Passport-style hero */}
      <HandDrawnCard className="animate-fade-up overflow-hidden p-0">
        <div className="px-8 pt-8 pb-7">
          <p className="text-sm font-medium text-[color:var(--ink-muted)]">Travel passport</p>
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

        <div className="flex flex-wrap items-center justify-between gap-5 border-y border-[color:var(--border)] px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-white font-heading text-2xl text-[color:var(--ink)]">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-heading text-2xl text-[color:var(--ink)]">
                {displayName}
              </h2>
              {profile?.username && (
                <p className="text-sm text-[color:var(--ink-muted)]">@{profile.username}</p>
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

        <div className="grid gap-0 divide-y divide-[color:var(--border)] md:grid-cols-2 md:divide-y-0 md:divide-x">
          <TraitCell label="Planning style" value={prettify(preferences.planningStyle)} />
          <TraitCell label="Authenticity" value={prettify(preferences.authenticityPreference)} />
        </div>
        <div className="grid gap-0 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)] md:grid-cols-3 md:divide-y-0 md:divide-x">
          <TraitCell label="Pace" value={prettify(preferences.travelPace)} />
          <TraitCell label="Budget" value={prettify(preferences.budgetRange)} />
          <TraitCell label="Travels with" value={prettify(preferences.socialPreferences)} />
        </div>

        <div className="border-t border-[color:var(--border)] px-8 py-6">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-[color:var(--ink-muted)]">Comfort zone</p>
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
        </div>
      </HandDrawnCard>

      <section className="animate-fade-up mt-5 grid gap-5 md:grid-cols-3" style={{ animationDelay: '0.1s' }}>
        <TagPanel title="Motivated by" items={preferences.travelMotivations} />
        <TagPanel title="Loves" items={preferences.activityTypes} />
        <TagPanel title="Eats" items={preferences.cuisinePreferences} />
      </section>

      <div className="animate-fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.15s' }}>
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
  );
}

function prettify(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function TraitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-8 py-5">
      <p className="text-xs font-medium text-[color:var(--ink-soft)]">{label}</p>
      <p className="mt-1 font-heading text-xl text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function TagPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <HandDrawnCard className="p-5">
      <p className="text-sm font-medium text-[color:var(--ink-muted)]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-sm italic text-[color:var(--ink-soft)]">None yet</span>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1 text-xs capitalize text-[color:var(--ink)]"
            >
              {prettify(item)}
            </span>
          ))
        )}
      </div>
    </HandDrawnCard>
  );
}
