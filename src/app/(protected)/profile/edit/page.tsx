'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UserPreferences } from '@/types/quiz';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { PromoChip } from '@/components/ui/promo-chip';

interface ProfileData {
  display_name: string;
  username: string | null;
}

const SELECT_CLASS =
  'w-full px-5 py-3 rounded-2xl bg-white border border-[color:var(--border)] ' +
  'font-body text-[15px] text-[color:var(--ink)] transition-all duration-200 ' +
  'focus:outline-none focus:border-[color:var(--accent)]/60 focus:ring-4 focus:ring-[color:var(--accent)]/15 ' +
  'shadow-[0_2px_10px_-4px_rgba(20,50,100,0.1)] ' +
  "appearance-none cursor-pointer bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b1e3c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")] " +
  'bg-[length:14px_14px] bg-[right_1rem_center] bg-no-repeat pr-10';

export default function EditProfilePage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [profile, setProfile] = useState<ProfileData>({ display_name: '', username: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prefsData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (prefsData) {
        setPreferences({
          id: prefsData.id,
          userId: prefsData.user_id,
          travelMotivations: prefsData.travel_motivations || [],
          planningStyle: prefsData.planning_style || '',
          authenticityPreference: prefsData.authenticity_preference || '',
          timeRhythm: prefsData.time_rhythm || '',
          comfortZone: prefsData.comfort_zone || 5,
          activityTypes: prefsData.activity_types || [],
          cuisinePreferences: prefsData.cuisine_preferences || [],
          budgetRange: prefsData.budget_range || '',
          travelPace: prefsData.travel_pace || '',
          socialPreferences: prefsData.social_preferences || '',
          rawAnswers: prefsData.raw_answers || {},
          createdAt: new Date(prefsData.created_at),
          updatedAt: new Date(prefsData.updated_at),
        });
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData);
      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    try {
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .update({
          travel_motivations: preferences.travelMotivations,
          planning_style: preferences.planningStyle,
          authenticity_preference: preferences.authenticityPreference,
          time_rhythm: preferences.timeRhythm,
          comfort_zone: preferences.comfortZone,
          activity_types: preferences.activityTypes,
          cuisine_preferences: preferences.cuisinePreferences,
          budget_range: preferences.budgetRange,
          travel_pace: preferences.travelPace,
          social_preferences: preferences.socialPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', preferences.userId);

      if (prefsError) throw prefsError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          username: profile.username || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', preferences.userId);

      if (profileError) throw profileError;

      router.push('/profile');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === '23505') {
        setError('Username is already taken. Please choose another one.');
      } else if (e.code === '23514') {
        setError('Username must be lowercase letters, numbers, and underscores only.');
      } else {
        setError('Failed to save changes. Please try again.');
      }
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <AppNav />
        <main className="relative mx-auto max-w-2xl px-6 pt-40 pb-24">
          <HandDrawnCard className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
            <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Loading</p>
          </HandDrawnCard>
        </main>
      </div>
    );
  }

  if (!preferences) return null;

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-2xl px-6 pt-32 pb-24">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Back to profile
        </Link>

        <section className="animate-fade-up">
          <PromoChip>Edit mode</PromoChip>
          <h1 className="mt-5 font-heading text-5xl leading-[0.95] text-[color:var(--ink)] md:text-6xl">
            Update your <span className="italic">profile</span>.
          </h1>
        </section>

        <HandDrawnCard
          className="animate-fade-up mt-10 p-7"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="space-y-8">
            {error && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            {/* Profile Info */}
            <div className="space-y-5 border-b border-[color:var(--border)] pb-8">
              <p className="text-sm font-medium text-[color:var(--ink-muted)]">
                Profile information
              </p>

              <HandDrawnInput
                label="Display name"
                value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                placeholder="Your name"
                required
              />

              <div>
                <HandDrawnInput
                  label="Username"
                  value={profile.username || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, username: e.target.value.toLowerCase() })
                  }
                  placeholder="username"
                />
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>
            </div>

            {/* Travel Preferences */}
            <div className="space-y-5">
              <p className="text-sm font-medium text-[color:var(--ink-muted)]">
                Travel preferences
              </p>

              <Field label="Planning style">
                <select
                  value={preferences.planningStyle}
                  onChange={(e) =>
                    setPreferences({ ...preferences, planningStyle: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="hyper_planner">Hyper planner</option>
                  <option value="structured_flexible">Structured but flexible</option>
                  <option value="loose_framework">Loose framework</option>
                  <option value="pure_spontaneous">Pure spontaneous</option>
                </select>
              </Field>

              <Field label="Authenticity preference">
                <select
                  value={preferences.authenticityPreference}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      authenticityPreference: e.target.value,
                    })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="authentic_local">Authentic &amp; local</option>
                  <option value="balanced">Balanced</option>
                  <option value="popular_spots">Popular spots</option>
                </select>
              </Field>

              <Field label="Time rhythm">
                <select
                  value={preferences.timeRhythm}
                  onChange={(e) =>
                    setPreferences({ ...preferences, timeRhythm: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="early_bird">Early bird</option>
                  <option value="steady_daytime">Steady daytime</option>
                  <option value="afternoon_evening">Afternoon / evening</option>
                  <option value="night_owl">Night owl</option>
                </select>
              </Field>

              <Field label="Budget">
                <select
                  value={preferences.budgetRange}
                  onChange={(e) =>
                    setPreferences({ ...preferences, budgetRange: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="budget">Budget-friendly</option>
                  <option value="moderate">Mid-range</option>
                  <option value="luxury">Luxury</option>
                </select>
              </Field>

              <Field label="Travel pace">
                <select
                  value={preferences.travelPace}
                  onChange={(e) =>
                    setPreferences({ ...preferences, travelPace: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="relaxed">Relaxed</option>
                  <option value="moderate">Balanced</option>
                  <option value="packed">Action-packed</option>
                </select>
              </Field>

              <Field label="Travel style">
                <select
                  value={preferences.socialPreferences}
                  onChange={(e) =>
                    setPreferences({ ...preferences, socialPreferences: e.target.value })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="solo">Solo traveler</option>
                  <option value="small_group">Small group</option>
                  <option value="large_group">Large group</option>
                </select>
              </Field>

              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--ink-muted)]">
                  Comfort zone · {preferences.comfortZone}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={preferences.comfortZone}
                  onChange={(e) =>
                    setPreferences({ ...preferences, comfortZone: parseInt(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--surface-soft)] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--ink)] [&::-webkit-slider-thumb]:shadow-[0_4px_12px_rgba(11,30,60,0.3)]"
                />
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                  1 = familiar &amp; comfortable · 10 = challenging &amp; adventurous
                </p>
              </div>
            </div>

            <div className="border-t border-[color:var(--border)] pt-6">
              <HandDrawnButton
                onClick={handleSave}
                disabled={saving || !profile.display_name}
                variant="primary"
                className="w-full gap-2"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </HandDrawnButton>
            </div>
          </div>
        </HandDrawnCard>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[color:var(--ink-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
