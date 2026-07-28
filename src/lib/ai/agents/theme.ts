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
 * Crude singular form. "museums" → "museum", "bookstores" → "bookstore".
 *
 * Not a real stemmer, and it does not need to be — it exists because people
 * type themes in the plural and research records categories in the singular.
 * Measured across the five real pools, that mismatch alone produced ZERO
 * anchors for "museums and galleries", "bookstores", and "coffee shops",
 * including in a pool that contains the Frist Art Museum.
 */
function singular(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  // "-es" is only a plural suffix after a sibilant (buses, boxes, churches).
  // Applying it everywhere turned "bookstores" into "bookstor", which matched
  // nothing at all.
  if (token.length > 4 && /(?:s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Does an intent token name the candidate's own category?
 *
 * This is the general form of what the nightlife bridge was doing by hand. A
 * candidate's `category` is research's own classification of what the thing
 * *is* — "museum", "shopping", "nightlife", "cultural" — so a theme token
 * landing there is strong evidence, categorically different from the same word
 * turning up in a sentence of marketing prose.
 *
 * It is also what separates the two hard cases. "museums and galleries" vs
 * `category: museum` matches and should score high. "house music" vs
 * `category: museum` matches nothing, so Louis Armstrong House Museum stays
 * where it belongs — a coincidence in the name, not a classification.
 */
function matchesCategory(category: string | undefined, keywords: string[]): boolean {
  const cat = (category || '').toLowerCase().trim();
  if (!cat) return false;
  const catTokens = cat.split(/[\s,/&_-]+/).filter(Boolean).map(singular);
  if (catTokens.length === 0) return false;
  // Exact token equality, not substring. Substring matching made "coffee
  // shops" match `category: shopping` and anchor a coffee theme on a taxidermy
  // store — "shop" is inside "shopping" and means something else entirely.
  return keywords.some((kw) => {
    const k = singular(kw);
    return k.length >= 3 && catTokens.some((c) => c === k);
  });
}

/**
 * How strongly a candidate serves the theme.
 *
 * Text matching delegates to the same phrase-first scorer the research curation
 * uses, so "on theme" means one thing across the pipeline. On top of it, a
 * category hit scores as a strong match — that is the general mechanism that
 * lets any theme find its own kind of place, rather than only the nightlife
 * themes a hand-written marker list happened to cover.
 */
export function themeScore(
  text: string,
  userIntent?: string,
  category?: string
): number {
  const kw = intentKeywords(userIntent);
  if (kw.length === 0) return 0;

  const textScore = intentMatchScore(text, kw);
  // Also try the singular forms against the text, so "bookstores" finds a
  // "bookstore" in a description.
  const stemmed = kw.map(singular);
  const stemScore =
    stemmed.join(' ') === kw.join(' ') ? 0 : intentMatchScore(text, stemmed);

  const categoryScore = matchesCategory(category, kw) ? 1 : 0;
  return Math.max(textScore, stemScore, categoryScore);
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
export function isOnTheme(
  text: string,
  userIntent?: string,
  category?: string
): boolean {
  if (themeScore(text, userIntent, category) >= 1) return true;
  // Genre themes stay the exception that needs a bridge: "house music" names a
  // sound, and no venue's category or copy says "house music". Everything else
  // is carried by the category match above.
  return isLateTheme(userIntent) && servesLateTheme(`${text} ${category ?? ''}`);
}
