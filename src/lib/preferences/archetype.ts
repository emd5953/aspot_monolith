import { UserPreferences } from '@/types/quiz';

/**
 * Lightweight "traveler archetype" derived from a user's quiz preferences.
 * This is pure presentation flavor — no DB column, computed on the fly.
 * The axes:
 *   - planningStyle (hyper/structured vs loose/spontaneous)
 *   - authenticityPreference (authentic vs popular spots)
 *   - travelPace (relaxed vs packed)
 * These three combine into 8 archetypes. Comfort zone nudges the copy.
 */
export interface TravelerArchetype {
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
  /** Short 1-2 sentence voice-over for the passport card */
  bio: string;
}

const ARCHETYPES: Record<string, Omit<TravelerArchetype, 'bio'>> = {
  'planned-authentic-relaxed': {
    slug: 'planned-authentic-relaxed',
    title: 'The Slow Local',
    tagline: 'Tucked-away tables, long afternoons.',
    emoji: '🍃',
  },
  'planned-authentic-packed': {
    slug: 'planned-authentic-packed',
    title: 'The Curious Scholar',
    tagline: 'A plan for every neighborhood, a story for every stop.',
    emoji: '📖',
  },
  'planned-popular-relaxed': {
    slug: 'planned-popular-relaxed',
    title: 'The Comfortable Classic',
    tagline: 'Greatest hits, taken at your pace.',
    emoji: '🎟️',
  },
  'planned-popular-packed': {
    slug: 'planned-popular-packed',
    title: 'The Optimizer',
    tagline: 'Every minute counts, every landmark checked.',
    emoji: '⚡',
  },
  'spontaneous-authentic-relaxed': {
    slug: 'spontaneous-authentic-relaxed',
    title: 'The Drifter',
    tagline: 'Wherever the afternoon takes you.',
    emoji: '🌿',
  },
  'spontaneous-authentic-packed': {
    slug: 'spontaneous-authentic-packed',
    title: 'The Street Poet',
    tagline: 'All day, all neighborhoods, no script.',
    emoji: '🎭',
  },
  'spontaneous-popular-relaxed': {
    slug: 'spontaneous-popular-relaxed',
    title: 'The Easygoing Tourist',
    tagline: 'Big sights, small worries.',
    emoji: '🏖️',
  },
  'spontaneous-popular-packed': {
    slug: 'spontaneous-popular-packed',
    title: 'The Adventurer',
    tagline: 'Pick a city. Say yes to everything.',
    emoji: '🔥',
  },
};

function planningAxis(style: string): 'planned' | 'spontaneous' {
  return style === 'hyper_planner' || style === 'structured_flexible'
    ? 'planned'
    : 'spontaneous';
}

function authAxis(pref: string): 'authentic' | 'popular' {
  return pref === 'popular_spots' ? 'popular' : 'authentic';
}

function paceAxis(pace: string): 'relaxed' | 'packed' {
  return pace === 'packed' ? 'packed' : pace === 'relaxed' ? 'relaxed' : 'relaxed';
}

export function getArchetype(prefs: UserPreferences): TravelerArchetype {
  const key = `${planningAxis(prefs.planningStyle)}-${authAxis(prefs.authenticityPreference)}-${paceAxis(prefs.travelPace)}`;
  const base = ARCHETYPES[key] ?? ARCHETYPES['planned-authentic-relaxed'];

  // Simple bio: stitched together from the same axes in prose form.
  const adventurous = prefs.comfortZone >= 7;
  const homebody = prefs.comfortZone <= 3;
  const social =
    prefs.socialPreferences === 'large_group' ||
    prefs.socialPreferences === 'small_group';

  const parts: string[] = [base.tagline];
  if (adventurous) {
    parts.push("You're happiest a little outside your comfort zone.");
  } else if (homebody) {
    parts.push('You like the familiar done really well.');
  }
  if (social) parts.push('Best with good company.');

  return { ...base, bio: parts.join(' ') };
}
