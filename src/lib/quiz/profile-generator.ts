import { SupabaseClient } from '@supabase/supabase-js';
import { QuizAnswer, UserPreferences } from '@/types/quiz';

export interface GeneratedProfile {
  cuisinePreferences: string[];
  activityTypes: string[];
  budgetRange: 'budget' | 'moderate' | 'luxury';
  travelPace: 'relaxed' | 'moderate' | 'packed';
  accommodationStyle: 'hostel' | 'hotel' | 'boutique' | 'luxury' | 'airbnb';
  socialPreferences: 'solo' | 'small_group' | 'large_group';
  accessibilityNeeds: string[];
  climatePreferences: string[];
  culturalInterests: string[];
  adventureTolerance: number;
}

export function generateProfile(answers: Record<string, QuizAnswer>): GeneratedProfile {
  const getArrayValue = (questionId: string): string[] => {
    const answer = answers[questionId];
    if (!answer) return [];
    return Array.isArray(answer.value) ? answer.value : [answer.value as string];
  };

  const getSingleValue = <T extends string>(questionId: string, defaultValue: T): T => {
    const answer = answers[questionId];
    if (!answer) return defaultValue;
    return answer.value as T;
  };

  const getNumberValue = (questionId: string, defaultValue: number): number => {
    const answer = answers[questionId];
    if (!answer) return defaultValue;
    return typeof answer.value === 'number' ? answer.value : defaultValue;
  };

  // Filter out 'none' from accessibility needs
  const accessibilityNeeds = getArrayValue('accessibility').filter((v) => v !== 'none');

  return {
    cuisinePreferences: getArrayValue('cuisine'),
    activityTypes: getArrayValue('activities'),
    budgetRange: getSingleValue('budget', 'moderate'),
    travelPace: getSingleValue('pace', 'moderate'),
    accommodationStyle: getSingleValue('accommodation', 'hotel'),
    socialPreferences: getSingleValue('social', 'small_group'),
    accessibilityNeeds,
    climatePreferences: getArrayValue('climate'),
    culturalInterests: getArrayValue('culture'),
    adventureTolerance: getNumberValue('adventure', 5),
  };
}

export async function saveUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  answers: Record<string, QuizAnswer>
): Promise<UserPreferences> {
  const profile = generateProfile(answers);

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        cuisine_preferences: profile.cuisinePreferences,
        activity_types: profile.activityTypes,
        budget_range: profile.budgetRange,
        travel_pace: profile.travelPace,
        accommodation_style: profile.accommodationStyle,
        social_preferences: profile.socialPreferences,
        accessibility_needs: profile.accessibilityNeeds,
        climate_preferences: profile.climatePreferences,
        cultural_interests: profile.culturalInterests,
        adventure_tolerance: profile.adventureTolerance,
        raw_answers: answers,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save user preferences: ${error.message}`);
  }

  return mapRowToPreferences(data);
}

export async function getUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get user preferences: ${error.message}`);
  }

  if (!data) return null;

  return mapRowToPreferences(data);
}

interface PreferencesRow {
  id: string;
  user_id: string;
  cuisine_preferences: string[];
  activity_types: string[];
  budget_range: 'budget' | 'moderate' | 'luxury';
  travel_pace: 'relaxed' | 'moderate' | 'packed';
  accommodation_style: 'hostel' | 'hotel' | 'boutique' | 'luxury' | 'airbnb';
  social_preferences: 'solo' | 'small_group' | 'large_group';
  accessibility_needs: string[];
  climate_preferences: string[];
  cultural_interests: string[];
  adventure_tolerance: number;
  raw_answers: Record<string, QuizAnswer>;
  created_at: string;
  updated_at: string;
}

function mapRowToPreferences(row: PreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    cuisinePreferences: row.cuisine_preferences,
    activityTypes: row.activity_types,
    budgetRange: row.budget_range,
    travelPace: row.travel_pace,
    accommodationStyle: row.accommodation_style,
    socialPreferences: row.social_preferences,
    accessibilityNeeds: row.accessibility_needs,
    climatePreferences: row.climate_preferences,
    culturalInterests: row.cultural_interests,
    adventureTolerance: row.adventure_tolerance,
    rawAnswers: row.raw_answers,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
