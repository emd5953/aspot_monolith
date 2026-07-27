import { tavily } from '@tavily/core';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  Attraction,
  Restaurant,
  ActivityOption,
  DestinationData,
} from '@/types/destination';
import { UserPreferences } from '@/types/quiz';
import {
  isPlaceVerificationEnabled,
  isHoursLookupEnabled,
  verifyAndFilter,
  findPlaceFromText,
  fetchPlaceHours,
} from '@/lib/maps/place-verification';
import { shouldSearchEvents, buildEventsQuery } from './events-search';

/** Trip dates, used only to gate + shape the date-aware events search. */
export interface TripDates {
  startDate: Date;
  endDate: Date;
}

/**
 * Tavily-backed destination research.
 *
 * Tavily takes search queries and returns AI-curated results from across the
 * web with relevance scores. It finds the right pages itself based on the
 * query — so we can encode user preferences directly into the search.
 *
 * Pipeline:
 *  1. Issue 3 targeted searches (attractions, restaurants, activities) shaped
 *     by user prefs.
 *  2. Pass the combined search results to gpt-4o-mini with a strict JSON
 *     extraction prompt to produce structured Attraction[], Restaurant[],
 *     ActivityOption[].
 *  3. Return a `DestinationData` for the existing pipeline to consume.
 */

export interface SearchHit {
  title: string;
  url: string;
  content: string; // Tavily-summarized snippet
  score: number;
}

let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  if (tavilyClient) return tavilyClient;
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn('[tavily] TAVILY_API_KEY not set — research disabled');
    return null;
  }
  tavilyClient = tavily({ apiKey: key });
  return tavilyClient;
}

/**
 * Build search queries shaped by user preferences and (optionally) free-text
 * intent from the original prompt. The query is what Tavily uses to decide
 * which pages to surface and summarize, so encoding intent here does the
 * heaviest lifting toward an on-theme research pool.
 *
 * Intent goes FIRST in each query because the leading tokens carry the most
 * weight in Tavily's relevance scoring.
 */
function buildSearchQueries(
  destination: string,
  prefs: UserPreferences,
  userIntent?: string
): { attractions: string; restaurants: string; activities: string } {
  const authenticity =
    prefs.authenticityPreference === 'authentic_local'
      ? 'local hidden gems off the beaten path'
      : prefs.authenticityPreference === 'popular_spots'
        ? 'top must-see iconic'
        : '';

  const interests = (prefs.activityTypes || []).slice(0, 3).join(' ');
  const motivations = (prefs.travelMotivations || []).slice(0, 2).join(' ');
  const cuisines = (prefs.cuisinePreferences || []).slice(0, 4).join(' ');

  const adventurous = (prefs.comfortZone ?? 5) >= 7 ? 'adventurous unique' : '';
  const budget =
    prefs.budgetRange === 'budget'
      ? 'budget affordable'
      : prefs.budgetRange === 'luxury'
        ? 'luxury upscale'
        : '';

  const intent = (userIntent || '').trim();

  return {
    attractions:
      `${intent} best ${authenticity} ${motivations} ${interests} ${adventurous} things to do attractions in ${destination}`
        .replace(/\s+/g, ' ')
        .trim(),
    restaurants:
      `${intent} best ${authenticity} ${cuisines} ${budget} restaurants where to eat in ${destination}`
        .replace(/\s+/g, ' ')
        .trim(),
    activities:
      `${intent} best ${authenticity} ${motivations} ${adventurous} activities experiences tours in ${destination}`
        .replace(/\s+/g, ' ')
        .trim(),
  };
}

/**
 * Build Reddit-biased search queries. Travel SEO buries the long-tail local
 * truth that Redditors post in earnest ("where do locals actually drink in
 * X?"), so we issue a parallel pass scoped to reddit.com. The `site:reddit.com`
 * operator keeps Tavily on Reddit threads; intent still leads for relevance.
 *
 * Exported for unit testing — it's a pure function of its inputs.
 */
export function buildRedditSearchQueries(
  destination: string,
  prefs: UserPreferences,
  userIntent?: string
): { attractions: string; restaurants: string; activities: string } {
  const interests = (prefs.activityTypes || []).slice(0, 3).join(' ');
  const cuisines = (prefs.cuisinePreferences || []).slice(0, 3).join(' ');
  const intent = (userIntent || '').trim();

  const build = (focus: string) =>
    `site:reddit.com ${intent} ${focus} in ${destination} recommendations`
      .replace(/\s+/g, ' ')
      .trim();

  return {
    attractions: build(`best ${interests} things to do`),
    restaurants: build(`best ${cuisines} restaurants where locals eat`),
    activities: build(`favorite ${interests} activities and experiences`),
  };
}

/**
 * Count how many Reddit hits name a given place. Case-insensitive substring
 * match against each hit's title+content; one hit counts at most once even if
 * it names the place repeatedly. Pure and exported for unit testing.
 */
export function countRedditMentions(name: string, redditHits: SearchHit[]): number {
  const needle = name.trim().toLowerCase();
  if (!needle) return 0;
  return redditHits.reduce((count, hit) => {
    const haystack = `${hit.title} ${hit.content}`.toLowerCase();
    return haystack.includes(needle) ? count + 1 : count;
  }, 0);
}

/** Stamp each candidate with how many Reddit hits mentioned it. */
function tagRedditMentions<T extends { name: string; redditMentions?: number }>(
  items: T[],
  redditHits: SearchHit[]
): T[] {
  if (redditHits.length === 0) return items;
  return items.map((item) => ({
    ...item,
    redditMentions: countRedditMentions(item.name, redditHits),
  }));
}

async function tavilySearch(
  query: string,
  maxResults = 8
): Promise<SearchHit[]> {
  const client = getTavilyClient();
  if (!client) return [];

  try {
    const result = await client.search(query, {
      searchDepth: 'advanced',
      maxResults,
      includeAnswer: false,
      includeRawContent: false,
    });

    return (result.results || []).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      score: r.score ?? 0,
    }));
  } catch (err) {
    console.warn(`[tavily] search failed for "${query}":`, err);
    return [];
  }
}

/**
 * Extract structured data (attractions/restaurants/activities) from a bundle
 * of Tavily search results using gpt-4o-mini. The model gets a clear schema
 * and a "JSON only" instruction.
 */
async function extractStructured<T>(
  hits: SearchHit[],
  destination: string,
  itemType: 'attraction' | 'restaurant' | 'activity' | 'event',
  schemaHint: string
): Promise<T[]> {
  if (hits.length === 0) return [];

  const corpus = hits
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.content}\nSource: ${h.url}`)
    .join('\n\n');

  const prompt = `You are extracting ${itemType}s from web search results about ${destination}.

SEARCH RESULTS:
${corpus}

Extract a JSON array of ${itemType}s mentioned. Each item must:
- Be a real place/establishment in ${destination} (not a category or generic concept)
- Have enough detail in the source to fill the schema
- NOT be made up if it isn't clearly named in the sources

Schema for each item:
${schemaHint}

Return up to 12 items. Pick the most distinct, well-described, and well-rated. Skip mentions that are too vague.

Respond with ONLY a JSON array. No prose, no code fences, no commentary.`;

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.2,
    });

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '');

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as T[];
    return [];
  } catch (err) {
    console.warn(`[tavily] extraction failed for ${itemType}:`, err);
    return [];
  }
}

const ATTRACTION_SCHEMA = `{
  "name": string (real place name),
  "description": string (1-2 sentences, what makes it worth visiting),
  "category": string ("museum" | "park" | "landmark" | "neighborhood" | "viewpoint" | "market" | "gallery" | "religious" | "shopping" | "entertainment"),
  "address": string (street address or neighborhood, never the same as name),
  "estimatedDuration": number (minutes, 30-180),
  "priceRange": string ("free" | "$" | "$$" | "$$$"),
  "rating": number (optional, 1-5)
}`;

const RESTAURANT_SCHEMA = `{
  "name": string (real restaurant name),
  "cuisine": string[] (e.g. ["japanese", "ramen"] — lowercase, specific),
  "priceRange": string ("$" | "$$" | "$$$" | "$$$$"),
  "address": string (street address, never the same as name),
  "rating": number (optional, 1-5)
}`;

const ACTIVITY_SCHEMA = `{
  "name": string (real activity/experience name),
  "description": string (1-2 sentences),
  "category": string ("tour" | "outdoor" | "food" | "wellness" | "adventure" | "cultural" | "nightlife" | "workshop"),
  "duration": number (minutes, 60-360),
  "priceRange": string ("free" | "$" | "$$" | "$$$"),
  "adventureLevel": number (1-10)
}`;

// Events are date-specific: a festival, concert, exhibition happening during the
// trip. They extract into the ActivityOption shape (so they merge into the
// activity pool) but with category "event" and the date embedded in the name so
// the planner can recognise and slot them on the right day.
const EVENT_SCHEMA = `{
  "name": string (the event name WITH its date, e.g. "NYC Jazz Festival (June 14)"),
  "description": string (1-2 sentences: what it is and where),
  "category": "event",
  "duration": number (minutes, 60-360),
  "priceRange": string ("free" | "$" | "$$" | "$$$"),
  "adventureLevel": number (1-10)
}`;

/**
 * Main entry point. Returns the same DestinationData shape the rest of the
 * pipeline expects, populated from Tavily search + LLM extraction.
 *
 * `userIntent` is an optional free-text focus from the user's prompt
 * (e.g. "R&B-leaning bars and live-music nightlife"). When supplied, it's
 * mixed into every Tavily query so the resulting pool actually contains
 * on-theme places.
 */
export async function fetchDestinationDataWithPrefs(
  destination: string,
  preferences: UserPreferences,
  userIntent?: string,
  tripDates?: TripDates
): Promise<DestinationData> {
  const queries = buildSearchQueries(destination, preferences, userIntent);
  const redditQueries = buildRedditSearchQueries(destination, preferences, userIntent);

  // Date-aware events: only worth a (paid) search when the trip is actually
  // upcoming and close enough that schedules exist. When it's not, we resolve
  // an empty hit list so the rest of the fan-out is unchanged.
  const runEvents = tripDates
    ? shouldSearchEvents(tripDates.startDate, tripDates.endDate)
    : false;
  const eventsSearch = runEvents
    ? tavilySearch(
        buildEventsQuery(destination, tripDates!.startDate, tripDates!.endDate, userIntent),
        6
      )
    : Promise.resolve([] as SearchHit[]);

  // Run the general + Reddit-targeted searches in parallel — Tavily handles
  // concurrent requests fine. The Reddit pass surfaces local-favorite truth
  // that travel SEO buries; its hits both feed extraction and become the
  // provenance signal for `redditMentions`.
  const [
    attractionHits,
    restaurantHits,
    activityHits,
    redditAttractionHits,
    redditRestaurantHits,
    redditActivityHits,
    eventHits,
  ] = await Promise.all([
    tavilySearch(queries.attractions, 10),
    tavilySearch(queries.restaurants, 10),
    tavilySearch(queries.activities, 8),
    tavilySearch(redditQueries.attractions, 6),
    tavilySearch(redditQueries.restaurants, 6),
    tavilySearch(redditQueries.activities, 6),
    eventsSearch,
  ]);

  console.log(
    `[tavily] Search hits — attractions:${attractionHits.length} restaurants:${restaurantHits.length} activities:${activityHits.length} | reddit:${redditAttractionHits.length}/${redditRestaurantHits.length}/${redditActivityHits.length} | events:${eventHits.length}${runEvents ? '' : ' (skipped)'}`
  );

  // Extract structured data in parallel too. Reddit hits join the corpus so
  // places only Redditors mention can still surface as candidates. Events get
  // their own extraction pass (different schema) and only when we searched.
  const [attractions, restaurants, activities, events] = await Promise.all([
    extractStructured<Attraction>(
      [...attractionHits, ...redditAttractionHits],
      destination,
      'attraction',
      ATTRACTION_SCHEMA
    ),
    extractStructured<Restaurant>(
      [...restaurantHits, ...redditRestaurantHits],
      destination,
      'restaurant',
      RESTAURANT_SCHEMA
    ),
    extractStructured<ActivityOption>(
      [...activityHits, ...redditActivityHits],
      destination,
      'activity',
      ACTIVITY_SCHEMA
    ),
    eventHits.length > 0
      ? extractStructured<ActivityOption>(eventHits, destination, 'event', EVENT_SCHEMA)
      : Promise.resolve([] as ActivityOption[]),
  ]);

  // Tag each candidate with how many Reddit threads named it — provenance the
  // scorer/planner can lean on ("three Reddit threads call this a local fave").
  // Date-specific events join the activity pool so the planner can slot them.
  const taggedAttractions = tagRedditMentions(attractions, redditAttractionHits);
  const taggedRestaurants = tagRedditMentions(restaurants, redditRestaurantHits);
  const taggedActivities = [
    ...tagRedditMentions(activities, redditActivityHits),
    ...events,
  ];

  console.log(
    `[tavily] Extracted — attractions:${attractions.length} restaurants:${restaurants.length} activities:${activities.length} events:${events.length}`
  );

  // Google Places resolution (flag-gated). Stamps real coordinates onto every
  // candidate we can resolve. This is the input geo-clustering runs on: days
  // only cluster by neighborhood once ~60% of the pool is located, so without
  // this pass every itinerary falls back to rank-ordering and days crisscross
  // the city. Unresolved candidates survive unlocated — see verifyAndFilter,
  // the failures are mostly dated events that legitimately have no Places entry.
  let verifiedAttractions = taggedAttractions;
  let verifiedRestaurants = taggedRestaurants;
  let verifiedActivities = taggedActivities;
  if (isPlaceVerificationEnabled()) {
    // Hours are a second hop per resolved place, so they carry their own switch.
    const hours = isHoursLookupEnabled() ? fetchPlaceHours : undefined;
    [verifiedAttractions, verifiedRestaurants, verifiedActivities] =
      await Promise.all([
        verifyAndFilter(taggedAttractions, destination, findPlaceFromText, { hours }),
        verifyAndFilter(taggedRestaurants, destination, findPlaceFromText, { hours }),
        verifyAndFilter(taggedActivities, destination, findPlaceFromText, { hours }),
      ]);
    const all = [
      ...verifiedAttractions,
      ...verifiedRestaurants,
      ...verifiedActivities,
    ];
    const located = all.filter((i) => i.coordinates).length;
    const timed = all.filter((i) => i.openingHours?.length).length;
    const total = all.length;
    console.log(
      `[tavily] Places-resolved — ${located}/${total} candidates carry coordinates (${Math.round((100 * located) / Math.max(total, 1))}% coverage; geo-clustering needs 60%), ${timed}/${total} carry opening hours`
    );
  }

  // Unique source URLs across every search, for citations downstream.
  const sources = Array.from(
    new Set(
      [
        ...attractionHits,
        ...restaurantHits,
        ...activityHits,
        ...redditAttractionHits,
        ...redditRestaurantHits,
        ...redditActivityHits,
        ...eventHits,
      ]
        .map((h) => h.url)
        .filter((u): u is string => Boolean(u))
    )
  );

  return {
    name: destination,
    country: '', // Tavily doesn't reliably give us this; not used downstream
    description: '',
    attractions: verifiedAttractions,
    restaurants: verifiedRestaurants,
    activities: verifiedActivities,
    localTips: [],
    sources,
    fetchedAt: new Date(),
  };
}

/**
 * Backwards-compatible export — same name as the original entry point.
 * Falls back gracefully when prefs aren't passed (uses generic queries).
 */
export async function fetchDestinationData(
  destination: string,
  preferences?: UserPreferences,
  userIntent?: string,
  tripDates?: TripDates
): Promise<DestinationData> {
  const fallbackPrefs: UserPreferences = {
    id: '',
    userId: '',
    travelMotivations: [],
    planningStyle: 'structured_flexible',
    authenticityPreference: 'balanced',
    timeRhythm: 'steady_daytime',
    comfortZone: 5,
    activityTypes: [],
    cuisinePreferences: [],
    budgetRange: 'moderate',
    travelPace: 'moderate',
    socialPreferences: 'couple',
    rawAnswers: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return fetchDestinationDataWithPrefs(destination, preferences ?? fallbackPrefs, userIntent, tripDates);
}
