import { UserPreferences } from '@/types/quiz';
import { Attraction, Restaurant, ActivityOption } from '@/types/destination';
import { ResearchResult } from '../ai/agents/types';

/**
 * Pre-filter the research pool by user preferences before the planner sees it.
 * The planner is bad at honoring "match user prefs" instructions, so we score
 * each candidate against the prefs and keep the top-N. The planner then picks
 * from a curated pool that already reflects the user's taste.
 *
 * Inputs are assumed to already be in canonical vocab (see normalize.ts).
 */

const FAMOUS_LANDMARK_HINTS = [
  'eiffel',
  'statue of liberty',
  'times square',
  'colosseum',
  'sagrada',
  'big ben',
  'tower bridge',
  'empire state',
  'central park',
  'golden gate',
  'shibuya crossing',
  'tokyo tower',
  'fisherman',
  'walk of fame',
  'hollywood sign',
  'champs',
  'louvre',
  'vatican',
  'trevi',
  'spanish steps',
  'machu picchu',
  'ancient',
  'cathedral',
];

const ADVENTUROUS_HINTS = [
  'hiking',
  'climb',
  'dive',
  'kayak',
  'paragliding',
  'zip',
  'bungee',
  'underground',
  'caves',
  'off-road',
  'trek',
  'wild',
  'extreme',
  'street art',
  'speakeasy',
  'hidden',
  'secret',
];

const PRICE_TIER: Record<string, number> = {
  free: 0,
  $: 1,
  budget: 1,
  '$$': 2,
  moderate: 2,
  mid: 2,
  '$$$': 3,
  expensive: 3,
  luxury: 3,
  '$$$$': 4,
  'fine dining': 4,
};

function priceTier(priceRange?: string): number {
  if (!priceRange) return 2;
  const key = priceRange.toLowerCase().trim();
  return PRICE_TIER[key] ?? 2;
}

function preferredTier(budget?: string): number {
  if (budget === 'budget') return 1;
  if (budget === 'luxury') return 3;
  return 2;
}

function looksFamous(name: string, description?: string): boolean {
  const haystack = `${name} ${description ?? ''}`.toLowerCase();
  return FAMOUS_LANDMARK_HINTS.some((hint) => haystack.includes(hint));
}

function looksAdventurous(item: { name: string; description?: string; category?: string; adventureLevel?: number }): boolean {
  if (typeof item.adventureLevel === 'number' && item.adventureLevel >= 7) return true;
  const haystack = `${item.name} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase();
  return ADVENTUROUS_HINTS.some((hint) => haystack.includes(hint));
}

// ——— Scorers ———

export function scoreAttraction(
  attraction: Attraction,
  prefs: UserPreferences
): number {
  let score = 50; // baseline

  // Activity-type match (e.g. user picked "museums" and attraction.category includes "museum")
  const activityTypes = (prefs.activityTypes || []).map((t) => t.toLowerCase());
  const motivations = (prefs.travelMotivations || []).map((t) => t.toLowerCase());
  const cat = (attraction.category || '').toLowerCase();
  const desc = (attraction.description || '').toLowerCase();

  for (const interest of [...activityTypes, ...motivations]) {
    if (cat.includes(interest) || desc.includes(interest)) score += 8;
  }

  // Authenticity
  const famous = looksFamous(attraction.name, attraction.description);
  if (prefs.authenticityPreference === 'authentic_local' && famous) score -= 25;
  if (prefs.authenticityPreference === 'popular_spots' && famous) score += 15;

  // Comfort zone vs adventurousness
  const adventurous = looksAdventurous(attraction);
  const cz = prefs.comfortZone ?? 5;
  if (cz >= 7 && adventurous) score += 10;
  if (cz <= 3 && adventurous) score -= 15;

  // Budget proxy via priceRange
  const tierGap = Math.abs(priceTier(attraction.priceRange) - preferredTier(prefs.budgetRange));
  score -= tierGap * 4;

  // Rating bonus (research sometimes returns this)
  if (typeof attraction.rating === 'number') score += attraction.rating * 2;

  return score;
}

export function scoreRestaurant(
  restaurant: Restaurant,
  prefs: UserPreferences
): number {
  let score = 50;

  // Cuisine match — biggest signal we have for restaurants
  const userCuisines = (prefs.cuisinePreferences || []).map((c) => c.toLowerCase());
  const restCuisines = (restaurant.cuisine || []).map((c) => c.toLowerCase());

  for (const wanted of userCuisines) {
    for (const has of restCuisines) {
      if (has.includes(wanted) || wanted.includes(has)) {
        score += 12;
      }
    }
  }

  // Special meta-cuisines from edit page (street_food, fine_dining)
  if (userCuisines.includes('street_food')) {
    const isStreet = restCuisines.some((c) =>
      ['street', 'food truck', 'casual', 'market'].some((k) => c.includes(k))
    );
    if (isStreet) score += 15;
  }
  if (userCuisines.includes('fine_dining')) {
    if (priceTier(restaurant.priceRange) >= 3) score += 12;
  }

  // Authenticity
  const famous = looksFamous(restaurant.name);
  if (prefs.authenticityPreference === 'authentic_local' && famous) score -= 20;
  if (prefs.authenticityPreference === 'popular_spots' && famous) score += 8;

  // Budget
  const tierGap = Math.abs(priceTier(restaurant.priceRange) - preferredTier(prefs.budgetRange));
  score -= tierGap * 5;

  if (typeof restaurant.rating === 'number') score += restaurant.rating * 2;

  return score;
}

export function scoreActivity(
  activity: ActivityOption,
  prefs: UserPreferences
): number {
  let score = 50;

  const activityTypes = (prefs.activityTypes || []).map((t) => t.toLowerCase());
  const motivations = (prefs.travelMotivations || []).map((t) => t.toLowerCase());
  const cat = (activity.category || '').toLowerCase();
  const desc = (activity.description || '').toLowerCase();

  for (const interest of [...activityTypes, ...motivations]) {
    if (cat.includes(interest) || desc.includes(interest)) score += 8;
  }

  // Comfort zone vs adventurousness
  const adventurous = looksAdventurous(activity);
  const cz = prefs.comfortZone ?? 5;
  if (cz >= 7 && adventurous) score += 12;
  if (cz <= 3 && adventurous) score -= 18;

  // Budget proxy
  const tierGap = Math.abs(priceTier(activity.priceRange) - preferredTier(prefs.budgetRange));
  score -= tierGap * 4;

  return score;
}

// ——— Top-N filter ———

interface FilterOptions {
  /** How many attractions to keep */
  attractionLimit?: number;
  /** How many restaurants to keep */
  restaurantLimit?: number;
  /** How many activities to keep */
  activityLimit?: number;
}

/**
 * Score every candidate, sort by score, keep top-N.
 * Returns a new ResearchResult — does not mutate the input.
 */
export function curateResearchByPreferences(
  research: ResearchResult,
  prefs: UserPreferences,
  options: FilterOptions = {}
): ResearchResult {
  const {
    attractionLimit = 12,
    restaurantLimit = 10,
    activityLimit = 8,
  } = options;

  const scoredAttractions = (research.attractions || [])
    .map((a) => ({ item: a, score: scoreAttraction(a, prefs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, attractionLimit)
    .map((s) => s.item);

  const scoredRestaurants = (research.restaurants || [])
    .map((r) => ({ item: r, score: scoreRestaurant(r, prefs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, restaurantLimit)
    .map((s) => s.item);

  const scoredActivities = (research.activities || [])
    .map((a) => ({ item: a, score: scoreActivity(a, prefs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, activityLimit)
    .map((s) => s.item);

  return {
    ...research,
    attractions: scoredAttractions,
    restaurants: scoredRestaurants,
    activities: scoredActivities,
  };
}
