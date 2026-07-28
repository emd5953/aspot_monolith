/**
 * The user's stated theme, as a structural input.
 *
 * A themed trip is not a search result page — a day still needs meals, daytime,
 * and rest. But the theme is supposed to be the *spine* the day hangs off, and
 * for a long time it was only ever advice inside an LLM prompt. A real run
 * asking for house music produced a 10:00 start, four boroughs, and a single
 * club treated as just another evening item, with Coney Island after it.
 *
 * This module owns the parts of a theme that are genuinely structural:
 *
 *   1. **Rhythm.** "House music" means the day ends late, so it should start
 *      late. That is what the words mean, not a taste judgement.
 *   2. **An anchor slot.** Clubs belong in the evening; a shopping theme
 *      belongs in the afternoon. Cheap, structural, decidable here.
 *
 * It deliberately does NOT decide whether a given venue serves the theme.
 *
 * That was tried, at length, and it was the wrong tool. Deciding that House of
 * Yes serves "house music" while the Louis Armstrong House Museum does not is
 * world knowledge; a text matcher can only see that both contain "house". Each
 * patch — stemming, category rules, nightlife marker lists — bought one case
 * and broke another ("shop" matching "shopping", "views" missing "viewpoint",
 * "bookstores" stemming to "bookstor"). Measured across five real research
 * pools it found anchors for nightlife themes and *zero* for museums, vintage
 * shopping, ramen, coffee or bookshops.
 *
 * So the judgement moved to where a model is already reading the source page:
 * `extractStructured` in tavily-service tags each candidate with `themeFit`.
 * Everything here stays deterministic, operating on that judgement rather than
 * guessing at English morphology.
 */

/**
 * How well a candidate serves the user's stated theme, as judged at extraction.
 *
 * - `direct`   — this IS the thing asked for.
 * - `adjacent` — serves the same trip without being the thing itself.
 * - `none`     — unrelated, however good it is.
 *
 * Absent (rather than `none`) means nobody judged it: no theme was given, or
 * the pool predates the field. Absent is *unknown*, and the theme checks stay
 * silent on it — the same rule the geographic checks follow without
 * coordinates.
 */
export type ThemeFit = 'direct' | 'adjacent' | 'none';

export type ThemeBucket = 'morning' | 'afternoon' | 'evening';

/** Anything carrying a model-judged theme fit. */
export interface ThemeTagged {
  themeFit?: ThemeFit;
}

/**
 * Words that mean the theme happens after dark. Matched on word boundaries so
 * "barcelona" does not read as "bar".
 *
 * This list survives the deletion of the rest of the string matching because it
 * reads the *user's own words*, not a venue's description — someone who typed
 * "house" into a trip prompt means the music, and no world knowledge is needed
 * to know that a club night implies a late start. It never touches candidates.
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

/** Does this theme run late? Asked of the user's phrasing only. */
export function isLateTheme(userIntent?: string): boolean {
  const intent = (userIntent || '').toLowerCase().trim();
  if (!intent) return false;
  return LATE_PATTERNS.some((p) => p.test(intent));
}

/**
 * The rhythm a theme implies, or null when it implies nothing. Returned as a
 * `timeRhythm` value the planner already understands.
 */
export function themeRhythm(userIntent?: string): 'night_owl' | null {
  return isLateTheme(userIntent) ? 'night_owl' : null;
}

/**
 * The effective rhythm for a trip: the theme wins over the quiz profile.
 *
 * Follows the contract already in AGENTS.md — profile is the floor, prompt is
 * the steering wheel. Someone who asked for house music this trip has said
 * something more specific and more recent than a quiz answer they gave once,
 * and scheduling their club night around an "early_bird" profile serves
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
 * evening; everything else anchors the afternoon, which has the most room and
 * the fewest fixed points.
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
 * Is this candidate a credible anchor for the theme?
 *
 * `direct` only. An `adjacent` place is worth having in the day — it is why
 * `adjacent` exists and why curation still ranks it up — but it is not what the
 * day should be built around. A record bar is a nice stop on a house music
 * trip; it is not the reason someone booked the trip.
 */
export function isAnchor(candidate: ThemeTagged): boolean {
  return candidate.themeFit === 'direct';
}

/** Does this candidate serve the theme at all? */
export function servesTheme(candidate: ThemeTagged): boolean {
  return candidate.themeFit === 'direct' || candidate.themeFit === 'adjacent';
}

/**
 * Ranking weight for a candidate's theme fit. Used to order anchor choices and
 * to bias curation; `0` for unknown so an untagged pool ranks on other signals
 * rather than being penalised.
 */
export function themeWeight(candidate: ThemeTagged): number {
  if (candidate.themeFit === 'direct') return 2;
  if (candidate.themeFit === 'adjacent') return 1;
  return 0;
}

/**
 * Did anything in this pool actually get judged?
 *
 * The theme checks run only when the answer is yes. An untagged pool means
 * nobody looked, and reporting "no day serves your theme" because the field is
 * missing would be the same failure as calling a place closed because its hours
 * are unknown.
 */
export function poolWasThemeTagged(candidates: ThemeTagged[]): boolean {
  return candidates.some((c) => c.themeFit !== undefined);
}
