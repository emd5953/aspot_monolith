import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences, QuizAnswer } from '@/types/quiz';

export interface UpdatePreferencesInput {
  travelMotivations?: string[];
  planningStyle?: string;
  authenticityPreference?: string;
  timeRhythm?: string;
  comfortZone?: number;
  cuisinePreferences?: string[];
  activityTypes?: string[];
  budgetRange?: string;
  travelPace?: string;
  socialPreferences?: string;
}

interface PreferencesRow {
  id: string;
  user_id: string;
  travel_motivations: string[];
  planning_style: string;
  authenticity_preference: string;
  time_rhythm: string;
  comfort_zone: number;
  cuisine_preferences: string[];
  activity_types: string[];
  budget_range: string;
  travel_pace: string;
  social_preferences: string;
  raw_answers: Record<string, QuizAnswer>;
  created_at: string;
  updated_at: string;
}

function mapRowToPreferences(row: PreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    travelMotivations: row.travel_motivations || [],
    planningStyle: row.planning_style || 'structured_flexible',
    authenticityPreference: row.authenticity_preference || 'balanced',
    timeRhythm: row.time_rhythm || 'steady_daytime',
    comfortZone: row.comfort_zone || 5,
    cuisinePreferences: row.cuisine_preferences || [],
    activityTypes: row.activity_types || [],
    budgetRange: row.budget_range || 'moderate',
    travelPace: row.travel_pace || 'moderate',
    socialPreferences: row.social_preferences || 'couple',
    rawAnswers: row.raw_answers || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getPreferences(
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
    throw new Error(`Failed to get preferences: ${error.message}`);
  }

  return data ? mapRowToPreferences(data as PreferencesRow) : null;
}

export async function updatePreferences(
  supabase: SupabaseClient,
  userId: string,
  updates: UpdatePreferencesInput
): Promise<UserPreferences> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.travelMotivations !== undefined) {
    updateData.travel_motivations = updates.travelMotivations;
  }
  if (updates.planningStyle !== undefined) {
    updateData.planning_style = updates.planningStyle;
  }
  if (updates.authenticityPreference !== undefined) {
    updateData.authenticity_preference = updates.authenticityPreference;
  }
  if (updates.timeRhythm !== undefined) {
    updateData.time_rhythm = updates.timeRhythm;
  }
  if (updates.comfortZone !== undefined) {
    updateData.comfort_zone = updates.comfortZone;
  }
  if (updates.cuisinePreferences !== undefined) {
    updateData.cuisine_preferences = updates.cuisinePreferences;
  }
  if (updates.activityTypes !== undefined) {
    updateData.activity_types = updates.activityTypes;
  }
  if (updates.budgetRange !== undefined) {
    updateData.budget_range = updates.budgetRange;
  }
  if (updates.travelPace !== undefined) {
    updateData.travel_pace = updates.travelPace;
  }
  if (updates.socialPreferences !== undefined) {
    updateData.social_preferences = updates.socialPreferences;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }

  return mapRowToPreferences(data as PreferencesRow);
}

export async function deletePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete preferences: ${error.message}`);
  }
}
