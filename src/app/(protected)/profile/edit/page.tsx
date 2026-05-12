'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UserPreferences } from '@/types/quiz';
import { AppNav } from '@/components/layout/app-nav';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';
import { PillPicker } from '@/components/profile/pill-picker';

interface ProfileData {
  display_name: string;
  username: string | null;
}

// ——— Option sets ———
const PLANNING_STYLES = [
  { value: 'hyper_planner', label: 'Plan every hour', emoji: '📋' },
  { value: 'structured_flexible', label: 'Loose plan', emoji: '🧭' },
  { value: 'loose_framework', label: 'Just anchors', emoji: '🗺️' },
  { value: 'pure_spontaneous', label: 'Pure improv', emoji: '🎲' },
];

const AUTHENTICITY = [
  { value: 'authentic_local', label: 'Off the trail', emoji: '🌿' },
  { value: 'balanced', label: 'Mix of both', emoji: '⚖️' },
  { value: 'popular_spots', label: 'The classics', emoji: '🎟️' },
];

const TIME_RHYTHMS = [
  { value: 'early_bird', label: 'Early bird', emoji: '🌅' },
  { value: 'steady_daytime', label: 'Daytime steady', emoji: '☀️' },
  { value: 'afternoon_evening', label: 'Late starter', emoji: '🌇' },
  { value: 'night_owl', label: 'Night owl', emoji: '🌙' },
];

const BUDGETS = [
  { value: 'budget', label: 'Budget', emoji: '🪙' },
  { value: 'moderate', label: 'Mid-range', emoji: '💳' },
  { value: 'luxury', label: 'Luxury', emoji: '✨' },
];

const PACES = [
  { value: 'relaxed', label: 'Relaxed', emoji: '🍵' },
  { value: 'moderate', label: 'Balanced', emoji: '🚶' },
  { value: 'packed', label: 'Action-packed', emoji: '⚡' },
];

const SOCIAL = [
  { value: 'solo', label: 'Solo', emoji: '🧍' },
  { value: 'couple', label: 'With a partner', emoji: '👫' },
  { value: 'small_group', label: 'Small group', emoji: '👯' },
  { value: 'large_group', label: 'Large group', emoji: '🎉' },
];

const MOTIVATIONS = [
  { value: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { value: 'culture', label: 'Culture', emoji: '🏛️' },
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'relaxation', label: 'Relaxation', emoji: '🛁' },
  { value: 'nature', label: 'Nature', emoji: '🌲' },
  { value: 'nightlife', label: 'Nightlife', emoji: '🪩' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'history', label: 'History', emoji: '📜' },
  { value: 'photography', label: 'Photography', emoji: '📷' },
  { value: 'wellness', label: 'Wellness', emoji: '🧘' },
];

const ACTIVITIES = [
  { value: 'hiking', label: 'Hiking', emoji: '🥾' },
  { value: 'museums', label: 'Museums', emoji: '🖼️' },
  { value: 'beaches', label: 'Beaches', emoji: '🏖️' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'concerts', label: 'Concerts', emoji: '🎶' },
  { value: 'cooking', label: 'Cooking classes', emoji: '🧑‍🍳' },
  { value: 'yoga', label: 'Yoga', emoji: '🧘' },
  { value: 'diving', label: 'Diving', emoji: '🤿' },
];

const CUISINES = [
  { value: 'italian', label: 'Italian', emoji: '🍝' },
  { value: 'japanese', label: 'Japanese', emoji: '🍣' },
  { value: 'mexican', label: 'Mexican', emoji: '🌮' },
  { value: 'french', label: 'French', emoji: '🥐' },
  { value: 'thai', label: 'Thai', emoji: '🍲' },
  { value: 'indian', label: 'Indian', emoji: '🍛' },
  { value: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { value: 'korean', label: 'Korean', emoji: '🍱' },
  { value: 'vietnamese', label: 'Vietnamese', emoji: '🍜' },
  { value: 'american', label: 'American', emoji: '🍔' },
  { value: 'street_food', label: 'Street food', emoji: '🥟' },
  { value: 'fine_dining', label: 'Fine dining', emoji: '🍾' },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EditProfilePage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [profile, setProfile] = useState<ProfileData>({ display_name: '', username: null });
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
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

  // Autosave helper. Called whenever a preference or the identity fields change.
  // Debounced so rapid chip toggling doesn't fire multiple writes.
  const scheduleSave = (
    nextPrefs: UserPreferences | null = preferences,
    nextProfile: ProfileData = profile
  ) => {
    if (!nextPrefs) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const { error: prefsError } = await supabase
          .from('user_preferences')
          .update({
            travel_motivations: nextPrefs.travelMotivations,
            planning_style: nextPrefs.planningStyle,
            authenticity_preference: nextPrefs.authenticityPreference,
            time_rhythm: nextPrefs.timeRhythm,
            comfort_zone: nextPrefs.comfortZone,
            activity_types: nextPrefs.activityTypes,
            cuisine_preferences: nextPrefs.cuisinePreferences,
            budget_range: nextPrefs.budgetRange,
            travel_pace: nextPrefs.travelPace,
            social_preferences: nextPrefs.socialPreferences,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', nextPrefs.userId);

        if (prefsError) throw prefsError;

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            display_name: nextProfile.display_name,
            username: nextProfile.username || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', nextPrefs.userId);

        if (profileError) throw profileError;

        setSaveState('saved');
        setError(null);
        // Revert to idle after a moment so the "Saved" pill fades out.
        setTimeout(() => setSaveState('idle'), 1600);
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === '23505') {
          setError('That username is already taken.');
        } else if (e.code === '23514') {
          setError('Username must be lowercase letters, numbers, and underscores only.');
        } else {
          setError('Something went wrong saving. Try again?');
        }
        setSaveState('error');
      }
    }, 500);
  };

  // Helpers that update state + trigger autosave in one call.
  const patchPrefs = (patch: Partial<UserPreferences>) => {
    if (!preferences) return;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    scheduleSave(next, profile);
  };

  const patchProfile = (patch: Partial<ProfileData>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    scheduleSave(preferences, next);
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
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Back to profile
          </Link>
          <SaveIndicator state={saveState} />
        </div>

        <section className="animate-fade-up mt-6">
          <h1 className="font-heading text-5xl leading-[0.95] text-[color:var(--ink)] md:text-6xl">
            Tune your <span className="italic">travel self</span>.
          </h1>
          <p className="mt-3 max-w-md text-base text-[color:var(--ink-muted)]">
            Changes save automatically. Tap chips to toggle — no forms to submit.
          </p>
        </section>

        {error && (
          <div className="animate-fade-up mt-6 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-5">
          {/* Identity */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.05s' }}
          >
            <h3 className="font-heading text-xl text-[color:var(--ink)]">You, in a line</h3>
            <div className="mt-5 space-y-4">
              <HandDrawnInput
                label="Display name"
                value={profile.display_name}
                onChange={(e) => patchProfile({ display_name: e.target.value })}
                placeholder="Your name"
                required
              />
              <div>
                <HandDrawnInput
                  label="Username"
                  value={profile.username || ''}
                  onChange={(e) =>
                    patchProfile({ username: e.target.value.toLowerCase() })
                  }
                  placeholder="username"
                />
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                  Lowercase letters, numbers, and underscores only.
                </p>
              </div>
            </div>
          </HandDrawnCard>

          {/* Planning style */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.1s' }}
          >
            <PillPicker
              label="How do you like to plan?"
              subtext="Steer how detailed your itineraries get."
              options={PLANNING_STYLES}
              value={preferences.planningStyle}
              onChange={(v) => patchPrefs({ planningStyle: v })}
            />
          </HandDrawnCard>

          {/* Authenticity */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.15s' }}
          >
            <PillPicker
              label="Tourist trail or tucked-away?"
              options={AUTHENTICITY}
              value={preferences.authenticityPreference}
              onChange={(v) => patchPrefs({ authenticityPreference: v })}
            />
          </HandDrawnCard>

          {/* Pace */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.2s' }}
          >
            <PillPicker
              label="What's your daily pace?"
              options={PACES}
              value={preferences.travelPace}
              onChange={(v) => patchPrefs({ travelPace: v })}
            />
          </HandDrawnCard>

          {/* Rhythm */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.25s' }}
          >
            <PillPicker
              label="When are you most yourself?"
              subtext="We'll front-load your best hours."
              options={TIME_RHYTHMS}
              value={preferences.timeRhythm}
              onChange={(v) => patchPrefs({ timeRhythm: v })}
            />
          </HandDrawnCard>

          {/* Budget */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.3s' }}
          >
            <PillPicker
              label="Budget range?"
              options={BUDGETS}
              value={preferences.budgetRange}
              onChange={(v) => patchPrefs({ budgetRange: v })}
            />
          </HandDrawnCard>

          {/* Social */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.35s' }}
          >
            <PillPicker
              label="Who's usually with you?"
              options={SOCIAL}
              value={preferences.socialPreferences}
              onChange={(v) => patchPrefs({ socialPreferences: v })}
            />
          </HandDrawnCard>

          {/* Comfort zone slider */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-xl text-[color:var(--ink)]">
                How adventurous?
              </h3>
              <span className="font-heading text-2xl text-[color:var(--ink)]">
                {preferences.comfortZone}
                <span className="text-[color:var(--ink-soft)]"> / 10</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              {preferences.comfortZone <= 3
                ? 'You like things familiar.'
                : preferences.comfortZone <= 6
                  ? 'A comfortable stretch is just right.'
                  : preferences.comfortZone <= 8
                    ? 'Bring on the unknown.'
                    : 'Throw me off the deep end.'}
            </p>
            <input
              type="range"
              min="1"
              max="10"
              value={preferences.comfortZone}
              onChange={(e) =>
                patchPrefs({ comfortZone: parseInt(e.target.value) })
              }
              className="mt-5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--surface-soft)] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--ink)] [&::-webkit-slider-thumb]:shadow-[0_4px_12px_rgba(11,30,60,0.3)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <div className="mt-2 flex justify-between text-xs text-[color:var(--ink-soft)]">
              <span>Familiar</span>
              <span>Challenging</span>
            </div>
          </HandDrawnCard>

          {/* Motivations — multi */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.45s' }}
          >
            <PillPicker
              label="What pulls you somewhere?"
              subtext="Pick as many as you want."
              options={MOTIVATIONS}
              value={preferences.travelMotivations}
              onChange={(v) => patchPrefs({ travelMotivations: v })}
            />
          </HandDrawnCard>

          {/* Activities — multi */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.5s' }}
          >
            <PillPicker
              label="What do you love doing?"
              options={ACTIVITIES}
              value={preferences.activityTypes}
              onChange={(v) => patchPrefs({ activityTypes: v })}
            />
          </HandDrawnCard>

          {/* Cuisines — multi */}
          <HandDrawnCard
            className="animate-fade-up p-7"
            style={{ animationDelay: '0.55s' }}
          >
            <PillPicker
              label="What are you craving?"
              subtext="Your go-to flavors. Pick a few."
              options={CUISINES}
              value={preferences.cuisinePreferences}
              onChange={(v) => patchPrefs({ cuisinePreferences: v })}
            />
          </HandDrawnCard>
        </div>

        <div
          className="animate-fade-up mt-8 flex justify-center"
          style={{ animationDelay: '0.6s' }}
        >
          <Link href="/profile">
            <HandDrawnButton variant="primary" size="md">
              Back to passport
            </HandDrawnButton>
          </Link>
        </div>
      </main>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') {
    return <span className="text-xs text-[color:var(--ink-soft)]">All saved</span>;
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-muted)]">
        <span className="h-3 w-3 animate-spin rounded-full border border-[color:var(--border)] border-t-[color:var(--accent)]" />
        Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800">
      Save failed
    </span>
  );
}
