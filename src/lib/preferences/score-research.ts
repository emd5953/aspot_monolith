import { UserPreferences } from '@/types/quiz';
import {
  ResearchResult,
  AttractionData,
  RestaurantData,
  ActivityData,
} from '../ai/agents/types';

/**
 * Pre-filter the research pool by user preferences before the planner sees it.
 * The planner is bad at honoring "match user prefs" instructions, so we score
 * each candidate against the prefs and keep the top-N. The planner then picks
 * from a curated pool that already reflects the user's taste.
 *
 * Inputs are assumed to already be in canonical vocab (see normalize.ts).
 */

/**
 * Tokenize a free-text intent string into useful keywords for matching against
 * candidate names/descriptions/categories. Drops stopwords and noise.
 */
function intentKeywords(userIntent?: string): string[] {
  if (!userIntent) return [];
  const stop = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'with',
    'by', 'at', 'from', 'is', 'are', 'be', 'leaning', 'style', 'focused',
    'big', 'lots', 'lot', 'really', 'very', 'some', 'any', 'kind',
  ]);
  return userIntent
    .toLowerCase()
    // Split on whitespace + most punctuation, but KEEP & inside tokens like "r&b".
    .split(/[\s,;:.!?()/\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

/**
 * Score how well a candidate matches the intent, phrase first.
 *
 * Counting loose token hits is what put "Louis Armstrong House Museum" and
 * "The Merchant House Museum" at the top of a *house music* trip: "house" is a
 * real word in both, so both scored the full keyword bonus. Word boundaries do
 * not help — it is a whole word there. The signal that separates them is the
 * phrase: "house music" appears in neither.
 *
 * So an intact phrase match is worth far more than the sum of its tokens, and a
 * lone token is worth little on its own. Substring matching is kept *within*
 * this scheme, because it is genuinely wanted for the single-token case ("bar"
 * should match "speakeasy bar", "r&b" should match "r&b lounge").
 *
 * Returns a weight multiplier, not a count — callers scale it by their own
 * intent weight.
 */
export function intentMatchScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = text.toLowerCase();

  // Whole intent, intact. The strongest possible signal.
  if (keywords.length > 1 && haystack.includes(keywords.join(' '))) {
    return keywords.length * 2;
  }

  // Any adjacent pair intact ("house music" out of "deep house music clubs").
  let pairHits = 0;
  for (let i = 0; i < keywords.length - 1; i++) {
    if (haystack.includes(`${keywords[i]} ${keywords[i + 1]}`)) pairHits++;
  }
  if (pairHits > 0) return pairHits * 2;

  // Fall back to loose tokens, deliberately weak. A multi-word intent that only
  // matches on one of its words is usually a coincidence, not a fit.
  const tokenHits = keywords.filter((kw) => haystack.includes(kw)).length;
  return keywords.length === 1 ? tokenHits : tokenHits * 0.25;
}

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
  attraction: AttractionData,
  prefs: UserPreferences,
  intentKw: string[] = []
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

  // User-intent match (free-text from prompt). Heavily weighted because this
  // is the user explicitly asking for a theme, which beats default prefs.
  const intentHits = intentMatchScore(
    `${attraction.name} ${attraction.description ?? ''} ${attraction.category ?? ''}`,
    intentKw
  );
  score += intentHits * 18;

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
  restaurant: RestaurantData,
  prefs: UserPreferences,
  intentKw: string[] = []
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

  // User-intent match — important for restaurants because the prompt often
  // names a vibe ("ramen", "cocktail", "rooftop") that's not in quiz prefs.
  const intentHits = intentMatchScore(
    `${restaurant.name} ${restCuisines.join(' ')}`,
    intentKw
  );
  score += intentHits * 18;

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
  activity: ActivityData,
  prefs: UserPreferences,
  intentKw: string[] = []
): number {
  let score = 50;

  const activityTypes = (prefs.activityTypes || []).map((t) => t.toLowerCase());
  const motivations = (prefs.travelMotivations || []).map((t) => t.toLowerCase());
  const cat = (activity.category || '').toLowerCase();
  const desc = (activity.description || '').toLowerCase();

  for (const interest of [...activityTypes, ...motivations]) {
    if (cat.includes(interest) || desc.includes(interest)) score += 8;
  }

  // User-intent match.
  const intentHits = intentMatchScore(
    `${activity.name} ${activity.description ?? ''} ${activity.category ?? ''}`,
    intentKw
  );
  score += intentHits * 18;

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
 *
 * `userIntent` is the free-text focus from the original prompt; when present,
 * candidates whose name/description match its keywords get a heavy bonus, so
 * the planner sees an on-theme pool first.
 */
/**
 * Take the top `limit` restaurants without letting one cuisine own the pool.
 *
 * The cuisine bonus in `scoreRestaurant` is the single strongest restaurant
 * signal, which meant a traveller whose quiz says "japanese, italian" got a
 * three-day Lisbon trip where four of five meals were Japanese — the Portuguese
 * places were real, well-rated, and ranked just below a wall of ramen. The
 * preference isn't wrong, it just shouldn't be able to erase the destination.
 *
 * So no single cuisine may take more than `maxShare` of the kept slots while
 * alternatives exist. Ranking is otherwise untouched: the best restaurants
 * still come first, and if the pool genuinely has nothing else, the overflow
 * fills the remaining slots rather than shipping a short list.
 */
export function diversifyByCuisine<T extends RestaurantData>(
  ranked: T[],
  limit: number,
  maxShare = 0.5
): T[] {
  const cap = Math.max(1, Math.ceil(limit * maxShare));
  const counts = new Map<string, number>();
  const kept: T[] = [];
  const overflow: T[] = [];

  for (const restaurant of ranked) {
    if (kept.length >= limit) break;
    const key = (restaurant.cuisine?.[0] || 'unknown').toLowerCase().trim();
    const seen = counts.get(key) ?? 0;
    if (seen >= cap) {
      overflow.push(restaurant);
      continue;
    }
    counts.set(key, seen + 1);
    kept.push(restaurant);
  }

  // Nothing else to offer — better a same-cuisine pool than a starved one.
  for (const restaurant of overflow) {
    if (kept.length >= limit) break;
    kept.push(restaurant);
  }

  return kept;
}

export function curateResearchByPreferences(
  research: ResearchResult,
  prefs: UserPreferences,
  options: FilterOptions = {},
  userIntent?: string
): ResearchResult {
  const {
    attractionLimit = 12,
    restaurantLimit = 10,
    activityLimit = 8,
  } = options;

  const intentKw = intentKeywords(userIntent);

  const scoredAttractions = (research.attractions || [])
    .map((a) => ({ item: a, score: scoreAttraction(a, prefs, intentKw) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, attractionLimit)
    .map((s) => s.item);

  const scoredRestaurants = diversifyByCuisine(
    (research.restaurants || [])
      .map((r) => ({ item: r, score: scoreRestaurant(r, prefs, intentKw) }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item),
    restaurantLimit
  );

  const scoredActivities = (research.activities || [])
    .map((a) => ({ item: a, score: scoreActivity(a, prefs, intentKw) }))
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
