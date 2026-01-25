import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences, QuizAnswer } from '@/types/quiz';

export interface UpdatePreferencesInput {
  cuisinePreferences?: string[];
  activityTypes?: string[];
  budgetRange?: 'budget' | 'moderate' | 'luxury';
  travelPace?: 'relaxed' | 'moderate' | 'packed';
  accommodationStyle?: 'hostel' | 'hotel' | 'boutique' | 'luxury' | 'airbnb';
  socialPreferences?: 'solo' | 'small_group' | 'large_group';
  accessibilityNeeds?: string[];
  climatePreferences?: string[];
  culturalInterests?: string[];
  adventureTolerance?: number;
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
  if (updates.accommodationStyle !== undefined) {
    updateData.accommodation_style = updates.accommodationStyle;
  }
  if (updates.socialPreferences !== undefined) {
    updateData.social_preferences = updates.socialPreferences;
  }
  if (updates.accessibilityNeeds !== undefined) {
    updateData.accessibility_needs = updates.accessibilityNeeds;
  }
  if (updates.climatePreferences !== undefined) {
    updateData.climate_preferences = updates.climatePreferences;
  }
  if (updates.culturalInterests !== undefined) {
    updateData.cultural_interests = updates.culturalInterests;
  }
  if (updates.adventureTolerance !== undefined) {
    updateData.adventure_tolerance = updates.adventureTolerance;
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
