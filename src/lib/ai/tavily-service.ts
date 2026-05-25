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

interface SearchHit {
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
 * Build search queries shaped by user preferences. The query is what Tavily
 * uses to decide which pages to surface and summarize, so encoding prefs here
 * does meaningful curation.
 */
function buildSearchQueries(
  destination: string,
  prefs: UserPreferences
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

  return {
    attractions: `best ${authenticity} ${motivations} ${interests} ${adventurous} things to do attractions in ${destination}`
      .replace(/\s+/g, ' ')
      .trim(),
    restaurants: `best ${authenticity} ${cuisines} ${budget} restaurants where to eat in ${destination}`
      .replace(/\s+/g, ' ')
      .trim(),
    activities: `best ${authenticity} ${motivations} ${adventurous} activities experiences tours in ${destination}`
      .replace(/\s+/g, ' ')
      .trim(),
  };
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
  itemType: 'attraction' | 'restaurant' | 'activity',
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

/**
 * Main entry point. Returns the same DestinationData shape the rest of the
 * pipeline expects, populated from Tavily search + LLM extraction.
 */
export async function fetchDestinationDataWithPrefs(
  destination: string,
  preferences: UserPreferences
): Promise<DestinationData> {
  const queries = buildSearchQueries(destination, preferences);

  // Run all three searches in parallel — Tavily handles concurrent fine.
  const [attractionHits, restaurantHits, activityHits] = await Promise.all([
    tavilySearch(queries.attractions, 10),
    tavilySearch(queries.restaurants, 10),
    tavilySearch(queries.activities, 8),
  ]);

  console.log(
    `[tavily] Search hits — attractions:${attractionHits.length} restaurants:${restaurantHits.length} activities:${activityHits.length}`
  );

  // Extract structured data in parallel too.
  const [attractions, restaurants, activities] = await Promise.all([
    extractStructured<Attraction>(
      attractionHits,
      destination,
      'attraction',
      ATTRACTION_SCHEMA
    ),
    extractStructured<Restaurant>(
      restaurantHits,
      destination,
      'restaurant',
      RESTAURANT_SCHEMA
    ),
    extractStructured<ActivityOption>(
      activityHits,
      destination,
      'activity',
      ACTIVITY_SCHEMA
    ),
  ]);

  console.log(
    `[tavily] Extracted — attractions:${attractions.length} restaurants:${restaurants.length} activities:${activities.length}`
  );

  return {
    name: destination,
    country: '', // Tavily doesn't reliably give us this; not used downstream
    description: '',
    attractions,
    restaurants,
    activities,
    localTips: [],
    fetchedAt: new Date(),
  };
}

/**
 * Backwards-compatible export — same name as the original entry point.
 * Falls back gracefully when prefs aren't passed (uses generic queries).
 */
export async function fetchDestinationData(
  destination: string,
  preferences?: UserPreferences
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
  return fetchDestinationDataWithPrefs(destination, preferences ?? fallbackPrefs);
}
