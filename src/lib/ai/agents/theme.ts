/**
 * The user's stated theme, as a structural input rather than a prompt string.
 *
 * A themed trip is not a search result page — a day still needs meals, daytime,
 * and rest. But the theme is supposed to be the *spine* the day hangs off, and
 * until now it was only ever advice inside an LLM prompt. A real run asking for
 * house music produced a 10:00 start, four boroughs, and a single club treated
 * as just another evening item, with Coney Island scheduled after it.
 *
 * Two things follow from a theme, and both are computable:
 *
 *   1. **Rhythm.** "House music" means the day ends late, so it should start
 *      late. That is not a taste judgement, it is what the words mean.
 *   2. **An anchor.** Every day should carry at least one item that obviously
 *      serves the theme, in the slot that theme belongs to — clubs in the
 *      evening, not at 11:00.
 *
 * Pure and I/O-free, so both are unit-testable and enforceable in code instead
 * of hoped for in a prompt.
 */

import { intentMatchScore, intentKeywords } from '@/lib/preferences/score-research';

export type ThemeBucket = 'morning' | 'afternoon' | 'evening';

/**
 * Words that mean the theme happens after dark. Matched on word boundaries so
 * "barcelona" does not read as "bar".
 *
 * Kept to things that are unambiguously night-time. "Music" is deliberately
 * absent — a music theme could just as easily be record shops or a matinee, and
 * a false positive here moves the whole day for no reason.
 */
const LATE_THEME_MARKERS = [
  'nightlife',
  'night',
  'club',
  'clubs',
  'clubbing',
  'nightclub',
  'bar',
  'bars',
  'pub',
  'pubs',
  'party',
  'parties',
  'rave',
  'raves',
  'techno',
  'house',
  'disco',
  'dj',
  'djs',
  'speakeasy',
  'cocktail',
  'cocktails',
  'live music',
  'jazz',
  'karaoke',
  'izakaya',
  'late',
];

const LATE_PATTERNS = LATE_THEME_MARKERS.map(
  (m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
);

/**
 * Does this theme run late?
 *
 * Note "house" is in the marker list, which on its own would also match "house
 * museum" — but this is asking about the *user's own words*, not a venue name.
 * Someone who typed "house" into a trip prompt means the music.
 */
export function isLateTheme(userIntent?: string): boolean {
  const intent = (userIntent || '').toLowerCase().trim();
  if (!intent) return false;
  return LATE_PATTERNS.some((p) => p.test(intent));
}

/**
 * The rhythm a theme implies, or null when it implies nothing.
 *
 * Returned as a `timeRhythm` value the planner already understands, so this
 * slots into the existing prompt instead of adding a parallel concept.
 */
export function themeRhythm(userIntent?: string): 'night_owl' | null {
  return isLateTheme(userIntent) ? 'night_owl' : null;
}

/**
 * The effective rhythm for a trip: the theme wins over the quiz profile.
 *
 * This follows the contract already stated in AGENTS.md — profile is the floor,
 * prompt is the steering wheel. Someone who asked for house music this trip has
 * told us something more specific and more recent than a quiz answer they gave
 * once, and scheduling their club night around an "early_bird" profile serves
 * neither signal.
 */
export function effectiveRhythm(
  profileRhythm: string | undefined,
  userIntent?: string
): string {
  return themeRhythm(userIntent) ?? profileRhythm ?? 'steady_daytime';
}

/**
 * Which part of the day the theme's anchor belongs in. Late themes anchor the
 * evening; everything else anchors the afternoon, which is the part of the day
 * with the most room and the fewest fixed points.
 */
export function anchorBucket(userIntent?: string): ThemeBucket {
  return isLateTheme(userIntent) ? 'evening' : 'afternoon';
}

/** When a themed anchor gets scheduled, by bucket. */
export const ANCHOR_TIME: Record<ThemeBucket, string> = {
  morning: '10:00',
  afternoon: '15:00',
  evening: '21:00',
};

/**
 * How strongly a candidate serves the theme.
 *
 * Delegates to the same phrase-first scorer the research curation uses, so
 * "on theme" means one thing across the pipeline. A jazz museum does not count
 * as house music here for exactly the same reason it does not count there.
 */
export function themeScore(
  text: string,
  userIntent?: string
): number {
  const kw = intentKeywords(userIntent);
  if (kw.length === 0) return 0;
  return intentMatchScore(text, kw);
}

/**
 * Words that mark a venue as serving a night-out theme, whatever the theme's
 * exact words were. Matched against the candidate's category and description,
 * which is where research actually records this.
 *
 * Only markers that mean *a place you go at night*. "live music", "party",
 * "dance" and "music venue" were here and had to come out: run against the real
 * NYC pool they matched "Museum Mile Festival", which repair then dutifully
 * moved to 21:00. Daytime things describe themselves with those words all the
 * time; nothing calls itself a nightclub by accident.
 */
const LATE_VENUE_MARKERS = [
  'nightlife',
  'nightclub',
  'night club',
  'club',
  'clubbing',
  'bar',
  'lounge',
  'speakeasy',
  'dj',
  'cocktail',
  'rave',
  'disco',
];

const LATE_VENUE_PATTERNS = LATE_VENUE_MARKERS.map(
  (m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
);

/**
 * Does this candidate serve a night-out theme by *kind*, rather than by words?
 *
 * Literal matching cannot bridge the gap that matters here. "House of Yes" is a
 * Bushwick club that the research pool records as `category: nightlife`,
 * described as a "vibrant nightlife venue… themed parties" — and the phrase
 * "house music" appears nowhere in it. Phrase-first scoring correctly rejects
 * "Louis Armstrong House Museum", and for exactly the same reason it rejects
 * the one venue in the pool that actually is the thing asked for.
 *
 * So a late theme also accepts a late-venue *kind*. This is a deliberate trade:
 * it loses precision (a cocktail bar now counts toward a "house music" theme)
 * to gain the recall without which no anchor is ever placed at all. The
 * deterministic layer's job is to guarantee the day has a night-out anchor;
 * choosing the *right* club among several is what the LLM planner and the
 * intent-scored pool ordering are for.
 */
export function servesLateTheme(text: string): boolean {
  const haystack = text.toLowerCase();
  return LATE_VENUE_PATTERNS.some((p) => p.test(haystack));
}

/**
 * Is this item a credible anchor for the theme?
 *
 * The word-match bar is deliberately above a single loose token:
 * `intentMatchScore` gives a lone token from a multi-word intent 0.25, which is
 * the score that let "Louis Armstrong House Museum" pass as house music.
 * Requiring more than that means a match has to be a phrase or a genuine
 * single-word hit — with `servesLateTheme` supplying recall by venue kind.
 */
export function isOnTheme(text: string, userIntent?: string): boolean {
  if (themeScore(text, userIntent) > 0.5) return true;
  return isLateTheme(userIntent) && servesLateTheme(text);
}
