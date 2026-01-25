import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getPreferences } from '@/lib/preferences/preferences-service';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const preferences = await getPreferences(supabase, user.id);

  if (!preferences) {
    redirect('/quiz');
  }

  // Get profile data including username
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-heading text-foreground">Your Travel Profile</h1>
          <Link href="/dashboard">
            <HandDrawnButton variant="secondary" size="sm">
              Back to Dashboard
            </HandDrawnButton>
          </Link>
        </div>

        {/* User Info Card */}
        <HandDrawnCard className="mb-6" decoration="tape">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-accent/20 border-2 border-foreground rounded-full flex items-center justify-center">
              <span className="text-3xl font-heading">{profile?.display_name?.[0] || user.email?.[0].toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-2xl font-heading text-foreground">{profile?.display_name || 'Traveler'}</h2>
              {profile?.username && (
                <p className="text-foreground/60 font-body">@{profile.username}</p>
              )}
              <p className="text-sm text-foreground/60 font-body">{user.email}</p>
            </div>
          </div>
        </HandDrawnCard>

        {/* Preferences Card */}
        <HandDrawnCard decoration="tack">
          <div className="grid gap-6">
            <ProfileSection title="Budget & Pace">
              <ProfileItem label="Budget" value={preferences.budgetRange} />
              <ProfileItem label="Travel Pace" value={preferences.travelPace} />
              <ProfileItem label="Adventure Level" value={`${preferences.adventureTolerance}/10`} />
            </ProfileSection>

            <ProfileSection title="Accommodation & Social">
              <ProfileItem label="Accommodation Style" value={preferences.accommodationStyle} />
              <ProfileItem label="Travel Style" value={preferences.socialPreferences.replace('_', ' ')} />
            </ProfileSection>

            <ProfileSection title="Food Preferences">
              <ProfileTags items={preferences.cuisinePreferences} />
            </ProfileSection>

            <ProfileSection title="Activities">
              <ProfileTags items={preferences.activityTypes} />
            </ProfileSection>

            <ProfileSection title="Cultural Interests">
              <ProfileTags items={preferences.culturalInterests} />
            </ProfileSection>

            <ProfileSection title="Climate Preferences">
              <ProfileTags items={preferences.climatePreferences} />
            </ProfileSection>

            {preferences.accessibilityNeeds.length > 0 && (
              <ProfileSection title="Accessibility Needs">
                <ProfileTags items={preferences.accessibilityNeeds} />
              </ProfileSection>
            )}
          </div>

          <div className="mt-8 pt-6 border-t-2 border-foreground/20 flex gap-4">
            <Link href="/profile/edit">
              <HandDrawnButton variant="accent">
                Edit Profile
              </HandDrawnButton>
            </Link>
            <Link href="/quiz">
              <HandDrawnButton variant="secondary">
                Retake Quiz
              </HandDrawnButton>
            </Link>
          </div>
        </HandDrawnCard>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-heading text-foreground mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-body">
      <span className="text-foreground/70">{label}</span>
      <span className="font-medium capitalize text-foreground">{value}</span>
    </div>
  );
}

function ProfileTags({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-foreground/40 font-body">None selected</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="px-3 py-1 bg-accent/20 text-foreground border-2 border-foreground border-wobbly-sm font-body text-sm capitalize"
        >
          {item.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
}
