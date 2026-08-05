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

import { googleServerKey } from './server-key';

export interface PlaceMatch {
  found: boolean;
  name?: string;
  address?: string;
  placeId?: string;
  location?: { lat: number; lng: number };
}

/**
 * One opening window, normalized to minutes since midnight on `day`
 * (0 = Sunday, matching both Google and `Date.getUTCDay()`).
 *
 * `close` may exceed 1440 for a window that runs past midnight — a bar open
 * 20:00–02:00 is `{ day: 5, open: 1200, close: 1560 }` rather than two rows.
 * Keeping it as one window is what lets `isOpenAt` answer "is this place open
 * at 21:00 on Friday" with a single comparison.
 */
export interface OpeningPeriod {
  day: number;
  open: number;
  close: number;
}

/** A week of opening windows. Empty array means "known to have no hours". */
export type WeeklyHours = OpeningPeriod[];

/** Candidate shape the verifier needs — every research item satisfies this. */
export interface VerifiableItem {
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  openingHours?: WeeklyHours;
}

/** Looks up a free-text query and returns the best real-place match. */
export type PlaceLookup = (query: string) => Promise<PlaceMatch>;

/** Resolves a place id to its weekly hours, or null when unknown. */
export type HoursLookup = (placeId: string) => Promise<WeeklyHours | null>;

/**
 * Verification runs whenever a server-side Google key is configured.
 *
 * Specifically GOOGLE_MAPS_SERVER_KEY, not the browser key — the lookups below
 * sign with the server key, so keying the flag off anything else would report
 * verification as on while every lookup came back empty.
 *
 * This used to be opt-in (`PLACES_VERIFICATION_ENABLED === 'true'`) so the
 * pipeline could run without a Google key. That guarantee is real but the flag
 * was the wrong way to buy it: nothing else stamps `coordinates`, so an unset
 * flag silently disabled geo-clustering in `pool-partition` (needs 60% located)
 * AND the two highest-severity geographic checks in `plan-audit`, which no-op
 * without coordinates. The default meant most deployments ran the geographic
 * quality machinery dark and had no signal that they were.
 *
 * Keying off the key keeps the no-key guarantee — and it degrades gracefully
 * anyway: `findPlaceFromText` returns `{found:false}` without a key, and
 * `verifyAndFilter` enriches rather than drops, so an unresolvable pool costs
 * accuracy, never coverage. `PLACES_VERIFICATION_ENABLED=false` still forces it
 * off for anyone who wants to skip the per-candidate lookup spend.
 */
export function isPlaceVerificationEnabled(): boolean {
  if (process.env.PLACES_VERIFICATION_ENABLED === 'false') return false;
  if (process.env.PLACES_VERIFICATION_ENABLED === 'true') return true;
  return Boolean(googleServerKey());
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

/** "0930" → 570. Google emits 4-digit local times; anything else is unusable. */
function parseHHMM(time: unknown): number | null {
  if (typeof time !== 'string' || !/^\d{4}$/.test(time)) return null;
  const h = Number(time.slice(0, 2));
  const m = Number(time.slice(2));
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Parse a Place Details `opening_hours.periods` array into `WeeklyHours`.
 *
 * Pure, and tolerant by design — an unparseable period is skipped rather than
 * throwing, because a partially-known week is still worth more than nothing and
 * this data feeds a *quality* check, not a correctness one. Two Google shapes
 * need handling:
 *
 * - **Always open**: a single period with `open.day = 0`, `open.time = "0000"`
 *   and no `close`. Expanded to a full open window on all seven days.
 * - **Overnight**: `close.day` differs from `open.day` (a bar closing at 02:00).
 *   Represented by extending `close` past 1440 on the opening day, so a single
 *   window covers the whole session.
 *
 * Returns null when there is no usable hours data at all, which callers must
 * distinguish from `[]` ("known closed all week").
 */
export function parseOpeningHours(data: unknown): WeeklyHours | null {
  if (!data || typeof data !== 'object') return null;
  const periods = (
    data as {
      opening_hours?: {
        periods?: Array<{
          open?: { day?: number; time?: string };
          close?: { day?: number; time?: string };
        }>;
      };
    }
  ).opening_hours?.periods;

  if (!Array.isArray(periods) || periods.length === 0) return null;

  // Always open — Google's documented sentinel for a 24/7 place.
  if (
    periods.length === 1 &&
    periods[0]?.open?.day === 0 &&
    periods[0]?.open?.time === '0000' &&
    !periods[0]?.close
  ) {
    return Array.from({ length: 7 }, (_, day) => ({ day, open: 0, close: 1440 }));
  }

  const out: WeeklyHours = [];
  for (const period of periods) {
    const day = period?.open?.day;
    const open = parseHHMM(period?.open?.time);
    if (typeof day !== 'number' || day < 0 || day > 6 || open === null) continue;

    let close = parseHHMM(period?.close?.time);
    if (close === null) {
      // Open with no stated close: treat as open through end of day rather
      // than dropping the window and reporting the place as shut.
      close = 1440;
    } else if (close <= open) {
      // Wrapped past midnight. Extend rather than splitting so the window
      // stays queryable in one comparison.
      close += 1440;
    }
    out.push({ day, open, close });
  }

  return out.length > 0 ? out : null;
}

/**
 * Is a place open at `minutes` past midnight on `weekday` (0 = Sunday)?
 *
 * Checks the previous day's windows too, so a 01:00 stop resolves against
 * Friday's 20:00–02:00 session rather than looking for a Saturday window that
 * does not exist. Pure.
 */
export function isOpenAt(
  hours: WeeklyHours,
  weekday: number,
  minutes: number
): boolean {
  const yesterday = (weekday + 6) % 7;
  return hours.some((p) => {
    if (p.day === weekday && minutes >= p.open && minutes < p.close) return true;
    // Overnight spillover from the previous day.
    if (p.day === yesterday && p.close > 1440 && minutes + 1440 < p.close) {
      return true;
    }
    return false;
  });
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
  options: {
    enabled?: boolean;
    drop?: boolean;
    /**
     * Optional second hop: fetch weekly opening hours for each resolved place.
     * Costs one Place Details call per resolved candidate, so it is separately
     * injectable and separately switchable — omit it and verification behaves
     * exactly as before.
     */
    hours?: HoursLookup;
  } = {}
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

        // Hours are best-effort on top of a successful resolution: a failed or
        // absent details call must leave the item exactly as verification found
        // it, never discard the coordinates we just earned.
        let openingHours = item.openingHours;
        if (options.hours && match.placeId) {
          try {
            openingHours = (await options.hours(match.placeId)) ?? openingHours;
          } catch {
            // Keep whatever we had; an unknown week is not a closed week.
          }
        }

        // Enrich the resolved item with the confirmed address/coords. Spreading
        // a generic T loses its narrowed type, so re-assert as T.
        return {
          ...item,
          address: match.address ?? item.address,
          coordinates: match.location ?? item.coordinates,
          openingHours,
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
/**
 * Are opening-hours lookups on?
 *
 * Separate switch from verification because it is a separate cost: one Place
 * Details call per *resolved* candidate, on top of the Find Place call every
 * candidate already pays. On by default when verification is — the check it
 * feeds replaces a name-matching guess with a fact — and `PLACES_HOURS_ENABLED=false`
 * turns it off without giving up coordinates.
 */
export function isHoursLookupEnabled(): boolean {
  if (process.env.PLACES_HOURS_ENABLED === 'false') return false;
  return isPlaceVerificationEnabled();
}

/**
 * Real Google Place Details hours lookup. Returns null on any failure — a
 * missing key, an API error, or a place with no published hours — so callers
 * treat "unknown" and "unavailable" identically and never infer closure from
 * an outage.
 */
export const fetchPlaceHours: HoursLookup = async (placeId) => {
  const apiKey = googleServerKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'opening_hours',
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 'OK') return null;
    return parseOpeningHours(data.result);
  } catch {
    return null;
  }
};

export const findPlaceFromText: PlaceLookup = async (query) => {
  const apiKey = googleServerKey();
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
