/**
 * Spotz has no onboarding quiz: the prompt carries everything. This module
 * keeps the `UserPreferences` shape the generation pipeline scores against,
 * plus the neutral default profile every generation now starts from.
 * "The prompt is the floor AND the steering wheel."
 *
 * Not DB-backed — migration 016 dropped `user_preferences`. Every generation
 * builds one of these in memory via `defaultPreferencesFor`, so a field here
 * only earns its place if something can actually vary it. The quiz-shaped
 * fields (motivations, cuisines, authenticity, raw answers) were removed:
 * nothing ever set them, so every branch reading them was a constant.
 */

export interface UserPreferences {
  id: string;
  userId: string;
  // Personality traits
  planningStyle: string;
  timeRhythm: string;
  comfortZone: number;
  // Activity & interests
  activityTypes: string[];
  // Practical preferences
  budgetRange: string;
  travelPace: string;
  socialPreferences: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Neutral profile: no steering — the parsed prompt does all the work. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'default',
  userId: 'default',
  planningStyle: 'flexible',
  timeRhythm: 'night_owl',
  comfortZone: 7,
  activityTypes: [],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  socialPreferences: 'small_group',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/** Per-user default profile (ids stamped in). */
export function defaultPreferencesFor(userId: string): UserPreferences {
  return { ...DEFAULT_PREFERENCES, id: `default-${userId}`, userId };
}
