'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { UserPreferences } from '@/types/quiz';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnInput } from '@/components/ui/hand-drawn-input';

interface ProfileData {
  display_name: string;
  username: string | null;
}

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Load preferences
      const { data: prefsData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (prefsData) {
        setPreferences({
          id: prefsData.id,
          userId: prefsData.user_id,
          cuisinePreferences: prefsData.cuisine_preferences,
          activityTypes: prefsData.activity_types,
          budgetRange: prefsData.budget_range,
          travelPace: prefsData.travel_pace,
          accommodationStyle: prefsData.accommodation_style,
          socialPreferences: prefsData.social_preferences,
          accessibilityNeeds: prefsData.accessibility_needs,
          climatePreferences: prefsData.climate_preferences,
          culturalInterests: prefsData.cultural_interests,
          adventureTolerance: prefsData.adventure_tolerance,
          rawAnswers: prefsData.raw_answers,
          createdAt: new Date(prefsData.created_at),
          updatedAt: new Date(prefsData.updated_at),
        });
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    try {
      // Update preferences
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .update({
          budget_range: preferences.budgetRange,
          travel_pace: preferences.travelPace,
          accommodation_style: preferences.accommodationStyle,
          social_preferences: preferences.socialPreferences,
          adventure_tolerance: preferences.adventureTolerance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', preferences.userId);

      if (prefsError) throw prefsError;

      // Update profile
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
    } catch (err: any) {
      if (err.code === '23505') {
        setError('Username is already taken. Please choose another one.');
      } else if (err.code === '23514') {
        setError('Username must be lowercase letters, numbers, and underscores only.');
      } else {
        setError('Failed to save changes. Please try again.');
      }
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground font-body text-lg">Loading...</div>
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-heading text-foreground">Edit Profile</h1>
          <Link href="/profile">
            <HandDrawnButton variant="secondary" size="sm">
              Cancel
            </HandDrawnButton>
          </Link>
        </div>

        <HandDrawnCard decoration="tape">
          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-500 border-wobbly-sm">
                <p className="text-red-700 font-body">{error}</p>
              </div>
            )}

            {/* Profile Info Section */}
            <div className="pb-6 border-b-2 border-foreground/20">
              <h2 className="text-2xl font-heading text-foreground mb-4">Profile Information</h2>
              
              <div className="space-y-4">
                <HandDrawnInput
                  label="Display Name"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Your name"
                  required
                />

                <div>
                  <HandDrawnInput
                    label="Username"
                    value={profile.username || ''}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase() })}
                    placeholder="username"
                  />
                  <p className="text-sm text-foreground/60 font-body mt-1">
                    Lowercase letters, numbers, and underscores only
                  </p>
                </div>
              </div>
            </div>

            {/* Travel Preferences Section */}
            <div>
              <h2 className="text-2xl font-heading text-foreground mb-4">Travel Preferences</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-foreground font-body text-lg mb-2">
                    Budget
                  </label>
                  <select
                    value={preferences.budgetRange}
                    onChange={(e) =>
                      setPreferences({ ...preferences, budgetRange: e.target.value as UserPreferences['budgetRange'] })
                    }
                    className="w-full px-4 py-3 bg-card border-2 border-foreground border-wobbly-sm font-body text-base text-foreground focus:outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent/20"
                  >
                    <option value="budget">Budget-friendly</option>
                    <option value="moderate">Mid-range</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>

                <div>
                  <label className="block text-foreground font-body text-lg mb-2">
                    Travel Pace
                  </label>
                  <select
                    value={preferences.travelPace}
                    onChange={(e) =>
                      setPreferences({ ...preferences, travelPace: e.target.value as UserPreferences['travelPace'] })
                    }
                    className="w-full px-4 py-3 bg-card border-2 border-foreground border-wobbly-sm font-body text-base text-foreground focus:outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent/20"
                  >
                    <option value="relaxed">Relaxed</option>
                    <option value="moderate">Balanced</option>
                    <option value="packed">Action-packed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-foreground font-body text-lg mb-2">
                    Accommodation Style
                  </label>
                  <select
                    value={preferences.accommodationStyle}
                    onChange={(e) =>
                      setPreferences({ ...preferences, accommodationStyle: e.target.value as UserPreferences['accommodationStyle'] })
                    }
                    className="w-full px-4 py-3 bg-card border-2 border-foreground border-wobbly-sm font-body text-base text-foreground focus:outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent/20"
                  >
                    <option value="hostel">Hostels</option>
                    <option value="airbnb">Vacation rentals</option>
                    <option value="hotel">Standard hotels</option>
                    <option value="boutique">Boutique hotels</option>
                    <option value="luxury">Luxury resorts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-foreground font-body text-lg mb-2">
                    Travel Style
                  </label>
                  <select
                    value={preferences.socialPreferences}
                    onChange={(e) =>
                      setPreferences({ ...preferences, socialPreferences: e.target.value as UserPreferences['socialPreferences'] })
                    }
                    className="w-full px-4 py-3 bg-card border-2 border-foreground border-wobbly-sm font-body text-base text-foreground focus:outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent/20"
                  >
                    <option value="solo">Solo traveler</option>
                    <option value="small_group">Small group</option>
                    <option value="large_group">Large group</option>
                  </select>
                </div>

                <div>
                  <label className="block text-foreground font-body text-lg mb-2">
                    Adventure Level: {preferences.adventureTolerance}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={preferences.adventureTolerance}
                    onChange={(e) =>
                      setPreferences({ ...preferences, adventureTolerance: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-card border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-foreground/20">
              <HandDrawnButton
                onClick={handleSave}
                disabled={saving || !profile.display_name}
                variant="accent"
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </HandDrawnButton>
            </div>
          </div>
        </HandDrawnCard>
      </div>
    </div>
  );
}
