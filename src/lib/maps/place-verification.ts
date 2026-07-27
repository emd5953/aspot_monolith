/**
 * Google Places verification — structural defense against hallucinated places.
 *
 * Research (Tavily + LLM extraction + Reddit) can surface a place that reads
 * plausibly but doesn't exist. Before candidates reach the planner we confirm
 * each one against Google's "Find Place From Text" endpoint: a candidate only
 * survives if Google can resolve it to a real place at a real address whose
 * name actually matches. Anything unverifiable is dropped.
 *
 * Gated behind PLACES_VERIFICATION_ENABLED (default OFF) so the pipeline runs
 * unchanged — and without a Google key — until verification is switched on.
 *
 * The network call is injectable (`lookup`) so the filter logic is unit-tested
 * without hitting the API.
 */

export interface PlaceMatch {
  found: boolean;
  name?: string;
  address?: string;
  placeId?: string;
  location?: { lat: number; lng: number };
}

/** Candidate shape the verifier needs — every research item satisfies this. */
export interface VerifiableItem {
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

/** Looks up a free-text query and returns the best real-place match. */
export type PlaceLookup = (query: string) => Promise<PlaceMatch>;

/** Feature flag. Verification only runs when explicitly enabled. */
export function isPlaceVerificationEnabled(): boolean {
  return process.env.PLACES_VERIFICATION_ENABLED === 'true';
}

/**
 * Parse a Google "Find Place From Text" response into a PlaceMatch. Pure — no
 * network — so the parsing/branching is unit-testable. ZERO_RESULTS and a
 * missing candidate both mean "not found" (not an error).
 */
export function parseFindPlaceResponse(data: unknown): PlaceMatch {
  if (!data || typeof data !== 'object') return { found: false };
  const d = data as {
    status?: string;
    candidates?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };

  if (d.status !== 'OK' || !d.candidates || d.candidates.length === 0) {
    return { found: false };
  }

  const c = d.candidates[0];
  const loc = c.geometry?.location;
  return {
    found: true,
    name: c.name,
    address: c.formatted_address,
    placeId: c.place_id,
    location:
      loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
        ? { lat: loc.lat, lng: loc.lng }
        : undefined,
  };
}

/**
 * Normalize a place name for comparison: lowercase, strip punctuation and
 * common filler so "The Dead Rabbit." matches "Dead Rabbit NYC".
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(the|a|an|restaurant|bar|cafe|caf|museum)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Guard against Google "helpfully" resolving a nonsense name to an unrelated
 * place: the matched name must share meaningful tokens with what we searched
 * for. Pure and exported for testing.
 */
export function nameMatches(candidateName: string, matchedName: string): boolean {
  const a = normalizeName(candidateName);
  const b = normalizeName(matchedName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  // Word-boundary-insensitive containment. Research names and Google names
  // disagree about spacing on the same real place — "Ben Fiddich" vs
  // "Bar Benfiddich", "Amo Yako" vs "Ameyoko market". Comparing with spaces
  // collapsed catches these; the length floor keeps short names from matching
  // each other by accident.
  const aTight = a.replace(/ /g, '');
  const bTight = b.replace(/ /g, '');
  if (
    Math.min(aTight.length, bTight.length) >= 6 &&
    (aTight.includes(bTight) || bTight.includes(aTight))
  ) {
    return true;
  }

  const aTokens = new Set(a.split(' ').filter((t) => t.length > 2));
  const bTokens = new Set(b.split(' ').filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return false;

  let shared = 0;
  for (const t of aTokens) if (bTokens.has(t)) shared++;
  // Require at least one shared significant token AND meaningful overlap.
  return shared > 0 && shared / Math.min(aTokens.size, bTokens.size) >= 0.5;
}

/**
 * Resolve candidates against real places and enrich them with the confirmed
 * address + coordinates. When the flag is off, items pass through untouched.
 *
 * **Enrich, don't drop.** An earlier version deleted every candidate it
 * couldn't resolve. Measured against the real research cache, ~10-25% of a pool
 * fails to resolve — and the failures are overwhelmingly things that correctly
 * have no Places entry: dated events ("Tokyo Game Show", "Santa Casa Alfama
 * Music Festival"), walking tours, and cooking classes. Dropping them silently
 * deleted the entire date-aware events feature from every itinerary. So an
 * unresolved candidate survives, just without coordinates.
 *
 * Coordinates are what matter downstream: `pool-partition` geo-clusters days
 * only once ~60% of the pool is located, so the point of this pass is coverage,
 * not censorship. A `lookup` failure affects only that one item and never
 * throws the pipeline.
 *
 * Pass `drop: true` for the old filtering behavior.
 */
export async function verifyAndFilter<T extends VerifiableItem>(
  items: T[],
  destination: string,
  lookup: PlaceLookup,
  options: { enabled?: boolean; drop?: boolean } = {}
): Promise<T[]> {
  const enabled = options.enabled ?? isPlaceVerificationEnabled();
  if (!enabled || items.length === 0) return items;

  const results = await Promise.all(
    items.map(async (item): Promise<T | null> => {
      try {
        const match = await lookup(`${item.name}, ${destination}`);
        if (!match.found || !match.name || !nameMatches(item.name, match.name)) {
          return options.drop ? null : item;
        }
        // Enrich the resolved item with the confirmed address/coords. Spreading
        // a generic T loses its narrowed type, so re-assert as T.
        return {
          ...item,
          address: match.address ?? item.address,
          coordinates: match.location ?? item.coordinates,
        } as T;
      } catch {
        // Unresolvable → keep the item, just unlocated. Never break the pipeline.
        return options.drop ? null : item;
      }
    })
  );

  return results.filter((r) => r !== null) as T[];
}

/**
 * Real Google "Find Place From Text" lookup. Thin network wrapper around the
 * parser above; returns `{ found: false }` rather than throwing on a missing
 * key or API error so verification degrades gracefully.
 */
export const findPlaceFromText: PlaceLookup = async (query) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { found: false };

  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address,geometry',
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`
    );
    if (!res.ok) return { found: false };
    return parseFindPlaceResponse(await res.json());
  } catch {
    return { found: false };
  }
};
