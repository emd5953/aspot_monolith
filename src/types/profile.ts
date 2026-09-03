/**
 * Spotz has no onboarding quiz: the prompt carries everything. This module
 * keeps the `UserPreferences` shape the generation pipeline scores against,
 * plus the neutral default profile every generation now starts from.
 * "The prompt is the floor AND the steering wheel."
 */

export interface UserPreferences {
  id: string;
  userId: string;
  // Personality traits
  travelMotivations: string[];
  planningStyle: string;
  authenticityPreference: string;
  timeRhythm: string;
  comfortZone: number;
  // Activity & interests
  activityTypes: string[];
  cuisinePreferences: string[];
  // Practical preferences
  budgetRange: string;
  travelPace: string;
  socialPreferences: string;
  // Legacy field kept for pipeline compatibility; always empty in Spotz.
  rawAnswers: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Neutral profile: no steering — the parsed prompt does all the work. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'default',
  userId: 'default',
  travelMotivations: [],
  planningStyle: 'flexible',
  authenticityPreference: 'local',
  timeRhythm: 'night_owl',
  comfortZone: 7,
  activityTypes: [],
  cuisinePreferences: [],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  socialPreferences: 'small_group',
  rawAnswers: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/** Per-user default profile (ids stamped in). */
export function defaultPreferencesFor(userId: string): UserPreferences {
  return { ...DEFAULT_PREFERENCES, id: `default-${userId}`, userId };
}
