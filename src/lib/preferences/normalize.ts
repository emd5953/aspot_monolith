import { UserPreferences } from '@/types/quiz';

/**
 * Canonical vocabulary for user preference enums.
 * Two sources (quiz + edit page) historically used different strings; this
 * file is the single source of truth that planner/reviewer/researcher all
 * agree on.
 *
 * Pipeline behavior: every entry point that consumes UserPreferences should
 * call `normalizePreferences()` first so downstream code only sees these
 * canonical values.
 */

export type CanonicalAuthenticity = 'authentic_local' | 'balanced' | 'popular_spots';
export type CanonicalPlanningStyle =
  | 'hyper_planner'
  | 'structured_flexible'
  | 'loose_framework'
  | 'pure_spontaneous';
export type CanonicalTravelPace = 'relaxed' | 'moderate' | 'packed';
export type CanonicalSocial =
  | 'solo'
  | 'couple'
  | 'small_group'
  | 'large_group';
export type CanonicalTimeRhythm =
  | 'early_bird'
  | 'steady_daytime'
  | 'afternoon_evening'
  | 'night_owl';
export type CanonicalBudget = 'budget' | 'moderate' | 'luxury';

// ——— Mappings from legacy values → canonical ———

const AUTH_MAP: Record<string, CanonicalAuthenticity> = {
  // canonical (passthrough)
  authentic_local: 'authentic_local',
  balanced: 'balanced',
  popular_spots: 'popular_spots',
  // legacy quiz vocab
  pure_authentic: 'authentic_local',
  mostly_authentic: 'authentic_local',
  tourist_friendly: 'popular_spots',
};

const PLANNING_MAP: Record<string, CanonicalPlanningStyle> = {
  hyper_planner: 'hyper_planner',
  structured_flexible: 'structured_flexible',
  loose_framework: 'loose_framework',
  pure_spontaneous: 'pure_spontaneous',
  // legacy synonyms occasionally seen in saved rows
  detailed_planner: 'hyper_planner',
  spontaneous: 'pure_spontaneous',
};

const PACE_MAP: Record<string, CanonicalTravelPace> = {
  relaxed: 'relaxed',
  moderate: 'moderate',
  packed: 'packed',
  // legacy
  slow: 'relaxed',
  fast: 'packed',
  busy: 'packed',
};

const SOCIAL_MAP: Record<string, CanonicalSocial> = {
  solo: 'solo',
  couple: 'couple',
  small_group: 'small_group',
  large_group: 'large_group',
  // legacy
  family: 'small_group',
  partner: 'couple',
};

const RHYTHM_MAP: Record<string, CanonicalTimeRhythm> = {
  early_bird: 'early_bird',
  steady_daytime: 'steady_daytime',
  afternoon_evening: 'afternoon_evening',
  night_owl: 'night_owl',
  // legacy
  morning: 'early_bird',
  daytime: 'steady_daytime',
  evening: 'afternoon_evening',
  late_night: 'night_owl',
};

const BUDGET_MAP: Record<string, CanonicalBudget> = {
  budget: 'budget',
  moderate: 'moderate',
  luxury: 'luxury',
  // legacy
  low: 'budget',
  mid: 'moderate',
  high: 'luxury',
};

// ——— Normalizer ———

/**
 * Returns a copy of `prefs` with all enum fields mapped to canonical vocab.
 * Unknown values fall back to a sensible default.
 */
export function normalizePreferences(prefs: UserPreferences): UserPreferences {
  return {
    ...prefs,
    authenticityPreference:
      AUTH_MAP[prefs.authenticityPreference?.toLowerCase()] ?? 'balanced',
    planningStyle:
      PLANNING_MAP[prefs.planningStyle?.toLowerCase()] ?? 'structured_flexible',
    travelPace: PACE_MAP[prefs.travelPace?.toLowerCase()] ?? 'moderate',
    socialPreferences: SOCIAL_MAP[prefs.socialPreferences?.toLowerCase()] ?? 'couple',
    timeRhythm: RHYTHM_MAP[prefs.timeRhythm?.toLowerCase()] ?? 'steady_daytime',
    budgetRange: BUDGET_MAP[prefs.budgetRange?.toLowerCase()] ?? 'moderate',
  };
}
