'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { UserPreferences } from '@/types/quiz';

export default function EditProfilePage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadPreferences() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPreferences({
          id: data.id,
          userId: data.user_id,
          cuisinePreferences: data.cuisine_preferences,
          activityTypes: data.activity_types,
          budgetRange: data.budget_range,
          travelPace: data.travel_pace,
          accommodationStyle: data.accommodation_style,
          socialPreferences: data.social_preferences,
          accessibilityNeeds: data.accessibility_needs,
          climatePreferences: data.climate_preferences,
          culturalInterests: data.cultural_interests,
          adventureTolerance: data.adventure_tolerance,
          rawAnswers: data.raw_answers,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        });
      }
      setLoading(false);
    }

    loadPreferences();
  }, [supabase, router]);

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    const { error } = await supabase
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

    setSaving(false);

    if (!error) {
      router.push('/profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Preferences</h1>
          <Link href="/profile" className="text-indigo-600 hover:text-indigo-700">
            Cancel
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget
            </label>
            <select
              value={preferences.budgetRange}
              onChange={(e) =>
                setPreferences({ ...preferences, budgetRange: e.target.value as UserPreferences['budgetRange'] })
              }
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="budget">Budget-friendly</option>
              <option value="moderate">Mid-range</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Travel Pace
            </label>
            <select
              value={preferences.travelPace}
              onChange={(e) =>
                setPreferences({ ...preferences, travelPace: e.target.value as UserPreferences['travelPace'] })
              }
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="relaxed">Relaxed</option>
              <option value="moderate">Balanced</option>
              <option value="packed">Action-packed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accommodation Style
            </label>
            <select
              value={preferences.accommodationStyle}
              onChange={(e) =>
                setPreferences({ ...preferences, accommodationStyle: e.target.value as UserPreferences['accommodationStyle'] })
              }
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="hostel">Hostels</option>
              <option value="airbnb">Vacation rentals</option>
              <option value="hotel">Standard hotels</option>
              <option value="boutique">Boutique hotels</option>
              <option value="luxury">Luxury resorts</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Travel Style
            </label>
            <select
              value={preferences.socialPreferences}
              onChange={(e) =>
                setPreferences({ ...preferences, socialPreferences: e.target.value as UserPreferences['socialPreferences'] })
              }
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="solo">Solo traveler</option>
              <option value="small_group">Small group</option>
              <option value="large_group">Large group</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full"
            />
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
