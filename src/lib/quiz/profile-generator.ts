import { SupabaseClient } from '@supabase/supabase-js';
import { QuizAnswer, UserPreferences } from '@/types/quiz';

export interface GeneratedProfile {
  travelMotivations: string[];
  planningStyle: string;
  authenticityPreference: string;
  activityTypes: string[];
  travelPace: string;
  timeRhythm: string;
  cuisinePreferences: string[];
  budgetRange: string;
  socialPreferences: string;
  comfortZone: number;
}

export function generateProfile(answers: Record<string, QuizAnswer>): GeneratedProfile {
  const getArrayValue = (questionId: string): string[] => {
    const answer = answers[questionId];
    if (!answer) return [];
    return Array.isArray(answer.value) ? answer.value : [answer.value as string];
  };

  const getSingleValue = (questionId: string, defaultValue: string): string => {
    const answer = answers[questionId];
    if (!answer) return defaultValue;
    return answer.value as string;
  };

  const getNumberValue = (questionId: string, defaultValue: number): number => {
    const answer = answers[questionId];
    if (!answer) return defaultValue;
    return typeof answer.value === 'number' ? answer.value : defaultValue;
  };

  return {
    travelMotivations: getArrayValue('travel_motivations'),
    planningStyle: getSingleValue('planning_style', 'structured_flexible'),
    authenticityPreference: getSingleValue('authenticity', 'balanced'),
    activityTypes: getArrayValue('activities'),
    travelPace: getSingleValue('pace', 'moderate'),
    timeRhythm: getSingleValue('time_rhythm', 'steady_daytime'),
    cuisinePreferences: getArrayValue('cuisine'),
    budgetRange: getSingleValue('budget', 'moderate'),
    socialPreferences: getSingleValue('social', 'couple'),
    comfortZone: getNumberValue('comfort_zone', 5),
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
        travel_motivations: profile.travelMotivations,
        planning_style: profile.planningStyle,
        authenticity_preference: profile.authenticityPreference,
        activity_types: profile.activityTypes,
        travel_pace: profile.travelPace,
        time_rhythm: profile.timeRhythm,
        cuisine_preferences: profile.cuisinePreferences,
        budget_range: profile.budgetRange,
        social_preferences: profile.socialPreferences,
        comfort_zone: profile.comfortZone,
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
  travel_motivations: string[];
  planning_style: string;
  authenticity_preference: string;
  activity_types: string[];
  travel_pace: string;
  time_rhythm: string;
  cuisine_preferences: string[];
  budget_range: string;
  social_preferences: string;
  comfort_zone: number;
  raw_answers: Record<string, QuizAnswer>;
  created_at: string;
  updated_at: string;
}

function mapRowToPreferences(row: PreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    travelMotivations: row.travel_motivations,
    planningStyle: row.planning_style,
    authenticityPreference: row.authenticity_preference,
    activityTypes: row.activity_types,
    travelPace: row.travel_pace,
    timeRhythm: row.time_rhythm,
    cuisinePreferences: row.cuisine_preferences,
    budgetRange: row.budget_range,
    socialPreferences: row.social_preferences,
    comfortZone: row.comfort_zone,
    rawAnswers: row.raw_answers,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
