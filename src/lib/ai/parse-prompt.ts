import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface ParsedPrompt {
  /** Destination city / place (required) */
  destination: string;
  /** ISO date string (YYYY-MM-DD) */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) */
  endDate: string;
  /** Suggested title (falls back to "Trip to {destination}") */
  title: string;
  /** Pace inferred from the prompt tone (relaxed/moderate/packed) */
  activityDensity: 'relaxed' | 'moderate' | 'packed';
  /**
   * The user's *focus / theme / must-haves* extracted from the prompt — the
   * thing that's NOT destination/dates/pace. e.g. "R&B-leaning bars and
   * live-music nightlife", "vegan ramen and quiet teahouses".
   *
   * Empty string when the prompt is just dates+city with no theme.
   * Used downstream to bias research queries, curation scoring, and
   * planner/reviewer prompts so the trip actually matches the request.
   */
  userIntent: string;
  /** The original prompt text, preserved verbatim for downstream agent prompts. */
  rawPrompt: string;
}

/**
 * Turn a one-line natural-language trip description into the structured
 * fields the itinerary generator expects. Examples:
 *   "2 nights in NYC, big on food"
 *     → { destination: "New York City", startDate: <soon>, endDate: <+2>, ... }
 *   "a long weekend in Lisbon in June"
 *     → { destination: "Lisbon", startDate: <first fri in june>, endDate: <+3>, ... }
 *   "Tokyo next month, packed days"
 *     → { destination: "Tokyo", startDate: <~30 days out>, endDate: <+7>, activityDensity: "packed" }
 *
 * Returns best-guess defaults for anything the prompt is silent on.
 */
export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
  const today = new Date();
  const defaultStart = addDays(today, 14); // two weeks out when unspecified
  const defaultEnd = addDays(defaultStart, 3); // 4 activity days fallback (start + 3)

  const systemPrompt = `You extract trip details from short natural-language requests.

Today's date: ${today.toISOString().split('T')[0]}.

Return a JSON object with these exact keys:
- destination (string): the city or place. Canonical form, e.g. "New York City" not "NYC".
- startDate (string): YYYY-MM-DD. If the user gave a vague time ("next month", "in June"), pick a reasonable specific date in that range. If they gave no timeframe at all, use "${defaultStart.toISOString().split('T')[0]}".
- endDate (string): YYYY-MM-DD. The trip is INCLUSIVE of both start and end dates — startDate and endDate should span exactly the number of ACTIVITY DAYS requested.
  Length rules:
    * "N days" = N activity days → endDate = startDate + (N-1)
    * "N nights" = N activity days → endDate = startDate + (N-1)    (a "2-night" trip has 2 full days of stuff)
    * "long weekend" = 3 activity days → endDate = startDate + 2
    * "a week" = 7 activity days → endDate = startDate + 6
    * If no length mentioned, default to 4 activity days → "${defaultEnd.toISOString().split('T')[0]}".
  Examples:
    "2 nights in NYC" starting 2026-05-25 → endDate 2026-05-26 (2 days: 25, 26).
    "3 days in Lisbon" starting 2026-06-10 → endDate 2026-06-12 (3 days: 10, 11, 12).
- title (string): a short friendly title, max 50 chars. Use what the user wrote if it reads well; otherwise "Trip to {destination}".
- activityDensity (string): "relaxed", "moderate", or "packed". Infer from tone ("chill", "slow" → relaxed; "see everything", "packed" → packed; otherwise moderate).
- userIntent (string): the THEME / FOCUS / MUST-HAVES the user cares about, distinct from destination/dates/pace. Capture the *vibe and any specific things they mentioned*, in 1-2 short clauses.
  Examples:
    "2 nights in NYC for R&B bars" → "R&B-leaning bars and live-music nightlife"
    "long weekend in Lisbon, vegan food and tile museums" → "vegan restaurants and traditional tile/azulejo museums"
    "Tokyo next month, packed days" → ""    (no theme, just pace)
    "4 days in Mexico City, cocktails and brutalist architecture" → "craft cocktail bars and brutalist/modernist architecture"
  Rules:
    * Preserve specific terms the user used (genres, cuisines, scenes, neighborhoods). Do NOT generalize "R&B" to "music" or "ramen" to "food".
    * Return "" (empty string) if the prompt has no theme beyond destination/dates/pace.
    * Keep it under ~120 chars. No prose, just the focus.

Respond with valid JSON only. No prose, no code fences.`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt,
    temperature: 0.2,
  });

  // The model occasionally wraps the JSON despite the instruction.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');

  let parsed: Partial<ParsedPrompt>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "I couldn't make sense of that. Try something like: '2 nights in NYC, big on food'"
    );
  }

  if (!parsed.destination || typeof parsed.destination !== 'string') {
    throw new Error(
      'Where to? Try including a destination, e.g. "4 days in Tokyo, food focused".'
    );
  }

  const destination = parsed.destination.trim();
  const startDate = isValidDate(parsed.startDate)
    ? parsed.startDate!
    : defaultStart.toISOString().split('T')[0];
  const endDate = isValidDate(parsed.endDate)
    ? parsed.endDate!
    : defaultEnd.toISOString().split('T')[0];

  // Sanity: end after start.
  const finalEnd =
    new Date(endDate) < new Date(startDate)
      ? addDays(new Date(startDate), 3).toISOString().split('T')[0]
      : endDate;

  return {
    destination,
    startDate,
    endDate: finalEnd,
    title:
      (typeof parsed.title === 'string' && parsed.title.trim()) ||
      `Trip to ${destination}`,
    activityDensity:
      parsed.activityDensity === 'relaxed' || parsed.activityDensity === 'packed'
        ? parsed.activityDensity
        : 'moderate',
    userIntent:
      typeof parsed.userIntent === 'string' ? parsed.userIntent.trim() : '',
    rawPrompt: prompt,
  };
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
