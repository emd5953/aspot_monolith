import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface ParsedPrompt {
  /** Always "New York City" — Spotz is NYC-only. */
  destination: string;
  /** ISO date (YYYY-MM-DD) of the outing. Defaults to today ("tonight"). */
  startDate: string;
  /** Same as startDate — a Spotz plan is one night/day out. */
  endDate: string;
  /** Suggested title (falls back to "Moves for tonight"). */
  title: string;
  /** Pace inferred from the prompt tone (relaxed/moderate/packed). */
  activityDensity: 'relaxed' | 'moderate' | 'packed';
  /**
   * The vibe / theme / must-haves — everything that steers curation.
   * e.g. "warehouse party, techno, cheap drinks" or "chill date night, wine bars".
   * Includes neighborhood mentions so downstream matching sees them too.
   */
  userIntent: string;
  /** Neighborhood/borough when the user named one (e.g. "Bushwick"), else "". */
  neighborhood: string;
  /** The original prompt text, preserved verbatim for downstream agent prompts. */
  rawPrompt: string;
}

/** Today's date in America/New_York regardless of server timezone. */
function nycToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Turn a one-line "what's the word" prompt into the structured fields the
 * generator expects. Spotz is NYC-only and one outing at a time:
 *   "moves for tonight, we tryna dance"       → today, vibe: dancing/nightlife
 *   "chill Sunday, good food, no cover"       → next Sunday, vibe: food + free
 *   "date night in the Village on Friday"     → next Friday, Greenwich Village
 */
export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
  const today = nycToday();

  const systemPrompt = `You extract outing details from short natural-language requests for Spotz, an app that plans one night/day out in New York City.

Today's date (New York): ${today}.

Return a JSON object with these exact keys:
- date (string): YYYY-MM-DD — WHEN the outing happens.
  * "tonight", "today", or no time mentioned → "${today}"
  * "tomorrow" → the day after
  * A weekday name ("friday") → the NEXT occurrence of that weekday (today counts if it matches)
  * "this weekend" → the next Saturday (today if Saturday)
- neighborhood (string): the NYC neighborhood or borough if the user names or clearly implies one ("bushwick", "the village" → "Greenwich Village", "BK" → "Brooklyn"). "" if none.
- title (string): a short, fun title, max 50 chars, in the user's energy (e.g. "Moves for tonight", "Date night in the Village"). Never corporate.
- activityDensity (string): "relaxed", "moderate", or "packed". Infer from tone ("chill", "low key" → relaxed; "big night", "run it all" → packed; otherwise moderate).
- userIntent (string): the VIBE / THEME / MUST-HAVES — what kind of moves they want. Preserve specific terms (genres, cuisines, scenes, "no cover", "rooftop", crew size). Include the neighborhood in it too when named. Under ~140 chars. "" only if the prompt is purely "plan something".
- notAnOuting (boolean): true ONLY if the input is a greeting, question, or gibberish with no outing request at all ("hi", "what can you do?", "asdf").

Respond with valid JSON only. No prose, no code fences.`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt,
    temperature: 0.2,
  });

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');

  let parsed: {
    date?: string;
    neighborhood?: string;
    title?: string;
    activityDensity?: string;
    userIntent?: string;
    notAnOuting?: boolean;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "I couldn't make sense of that. Try something like: 'find the moves for tonight, Brooklyn'"
    );
  }

  if (parsed.notAnOuting) {
    throw new Error("Say the vibe and I'll find the moves — e.g. 'chill date night in the Village'.");
  }

  // Date sanity: valid, today-or-later, within 14 days. Anything else → today.
  let date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
    ? parsed.date
    : today;
  if (date < today || date > addDaysIso(today, 14)) {
    date = today;
  }

  const neighborhood =
    typeof parsed.neighborhood === 'string' ? parsed.neighborhood.trim() : '';

  return {
    destination: 'New York City',
    startDate: date,
    endDate: date,
    title:
      (typeof parsed.title === 'string' && parsed.title.trim()) || 'Moves for tonight',
    activityDensity:
      parsed.activityDensity === 'relaxed' || parsed.activityDensity === 'packed'
        ? parsed.activityDensity
        : 'moderate',
    userIntent: typeof parsed.userIntent === 'string' ? parsed.userIntent.trim() : '',
    neighborhood,
    rawPrompt: prompt,
  };
}
