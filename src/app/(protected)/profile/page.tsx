import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getPreferences } from '@/lib/preferences/preferences-service';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { PromoChip } from '@/components/ui/promo-chip';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const preferences = await getPreferences(supabase, user.id);
  if (!preferences) redirect('/quiz');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single();

  const initial =
    profile?.display_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <section className="animate-fade-up">
          <PromoChip>Your profile</PromoChip>
          <h1 className="mt-5 font-heading text-6xl leading-[0.95] text-[color:var(--ink)] md:text-7xl">
            Travel <span className="italic">profile</span>.
          </h1>
          <p className="mt-4 max-w-md text-base text-[color:var(--ink-muted)]">
            The preferences powering every itinerary we build for you.
          </p>
        </section>

        {/* Identity */}
        <HandDrawnCard
          className="animate-fade-up mt-10 p-7"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] font-heading text-2xl text-[color:var(--ink)]">
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-heading text-3xl text-[color:var(--ink)]">
                {profile?.display_name || 'Traveler'}
              </h2>
              {profile?.username && (
                <p className="text-sm text-[color:var(--ink-muted)]">@{profile.username}</p>
              )}
              <p className="truncate text-sm text-[color:var(--ink-soft)]">{user.email}</p>
            </div>
          </div>
        </HandDrawnCard>

        {/* Preferences */}
        <HandDrawnCard
          className="animate-fade-up mt-5 p-7"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="grid gap-8">
            <ProfileSection title="Travel personality">
              <ProfileItem
                label="Planning style"
                value={preferences.planningStyle?.replace('_', ' ') || 'balanced'}
              />
              <ProfileItem
                label="Authenticity preference"
                value={preferences.authenticityPreference?.replace('_', ' ') || 'balanced'}
              />
              <ProfileItem
                label="Time rhythm"
                value={preferences.timeRhythm?.replace('_', ' ') || 'daytime'}
              />
              <ProfileItem
                label="Comfort zone"
                value={`${preferences.comfortZone || 5}/10`}
              />
            </ProfileSection>

            <ProfileSection title="Travel motivations">
              <ProfileTags items={preferences.travelMotivations || []} />
            </ProfileSection>

            <ProfileSection title="Budget & pace">
              <ProfileItem label="Budget" value={preferences.budgetRange} />
              <ProfileItem label="Travel pace" value={preferences.travelPace} />
              <ProfileItem
                label="Social style"
                value={preferences.socialPreferences?.replace('_', ' ') || 'couple'}
              />
            </ProfileSection>

            <ProfileSection title="Food preferences">
              <ProfileTags items={preferences.cuisinePreferences} />
            </ProfileSection>

            <ProfileSection title="Activities">
              <ProfileTags items={preferences.activityTypes} />
            </ProfileSection>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-[color:var(--border)] pt-6">
            <Link href="/profile/edit">
              <HandDrawnButton variant="primary" size="sm" className="gap-2">
                Edit profile
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </HandDrawnButton>
            </Link>
            <Link href="/quiz">
              <HandDrawnButton variant="secondary" size="sm">
                Retake quiz
              </HandDrawnButton>
            </Link>
          </div>
        </HandDrawnCard>
      </main>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[color:var(--ink-muted)]">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-[color:var(--ink-muted)]">{label}</span>
      <span className="font-heading text-xl capitalize text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

function ProfileTags({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-[color:var(--ink-soft)]">None selected</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs capitalize text-[color:var(--ink)]"
        >
          {item.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
}
