import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getPreferences } from '@/lib/preferences/preferences-service';

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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Travel Profile</h1>
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
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

          <div className="mt-8 pt-6 border-t flex gap-4">
            <Link
              href="/profile/edit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Edit Preferences
            </Link>
            <Link
              href="/quiz"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Retake Quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

function ProfileTags({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-gray-400">None selected</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm capitalize"
        >
          {item.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
}
