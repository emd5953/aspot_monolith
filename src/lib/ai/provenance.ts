/**
 * Provenance — where did a scheduled item actually come from?
 *
 * Every candidate that reaches the planner started life in one of a few places:
 * a generic Tavily web search, a Reddit-scoped search pass, or a Google Places
 * verification. We carry that origin through the pipeline so the itinerary view
 * can tell the user *why* a spot is here ("locals rave about it on Reddit" vs
 * "we found it on the web" vs "the AI suggested it").
 *
 * The signals already ride along on the research candidates:
 *   - `redditMentions` (count) is stamped by the Reddit research pass.
 *   - `coordinates` are stamped only when Google Places verification resolves
 *     the candidate to a real place.
 * Anything the planner names that we can't trace back to a researched candidate
 * is, honestly, an AI suggestion.
 *
 * These are pure functions with no I/O so they're cheap to unit-test and safe
 * to call anywhere in the pipeline.
 */

export type ItemSource = 'reddit' | 'places' | 'tavily' | 'ai';

/** The subset of a candidate the source derivation actually looks at. */
export interface ProvenanceSignals {
  redditMentions?: number;
  coordinates?: { lat: number; lng: number } | null;
}

/** Short human label per source, shared by the view and its tests. */
export const SOURCE_LABELS: Record<ItemSource, string> = {
  reddit: 'Reddit favorite',
  places: 'Google-verified',
  tavily: 'Web research',
  ai: 'AI suggestion',
};

/**
 * Decide a single item's source from its signals. Order matters: a place that
 * Redditors mention *and* Google verified is most interestingly a Reddit
 * favorite, so Reddit wins, then Places, then plain web research.
 */
export function deriveSource(signals: ProvenanceSignals | null | undefined): ItemSource {
  if (!signals) return 'ai';
  if ((signals.redditMentions ?? 0) > 0) return 'reddit';
  const c = signals.coordinates;
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return 'places';
  return 'tavily';
}

/** Strength order so a dup candidate can upgrade a weaker earlier reading. */
function rank(source: ItemSource): number {
  return source === 'reddit' ? 3 : source === 'places' ? 2 : source === 'tavily' ? 1 : 0;
}

/** Normalize a place name for matching: lowercase, punctuation → spaces. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ProvenanceCandidate extends ProvenanceSignals {
  name: string;
}

/**
 * Build a name → source lookup from the research pool. The planner emits items
 * by name, so this lets us recover each item's origin after the fact. When the
 * same name appears with different signals, the strongest source wins.
 */
export function buildProvenanceIndex(
  candidates: ReadonlyArray<ProvenanceCandidate>
): Map<string, ItemSource> {
  const index = new Map<string, ItemSource>();
  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    if (!key) continue;
    const source = deriveSource(candidate);
    const existing = index.get(key);
    if (existing === undefined || rank(source) > rank(existing)) {
      index.set(key, source);
    }
  }
  return index;
}

/**
 * Look a planned item's name up in the research index. Anything we can't trace
 * back to a researched candidate is reported as an AI suggestion — that's the
 * truthful provenance, not a bug.
 */
export function lookupSource(name: string, index: Map<string, ItemSource>): ItemSource {
  return index.get(normalizeName(name)) ?? 'ai';
}
