/**
 * Per-day partitioning of the curated research pool.
 *
 * The agentic planner builds days in parallel, so every day used to see the
 * same top-of-pool candidates — all days picked the same best items, and the
 * cross-day dedup pass then punched holes in days 2+. Partitioning the pool
 * into disjoint per-day slices up front removes the contention: each parallel
 * day build draws from its own pool.
 *
 * Attractions are grouped geographically when enough of them carry real
 * coordinates (stamped by Google Places verification), so "keep the day in one
 * neighborhood" is grounded in data instead of LLM guesswork. Restaurants
 * follow the attraction clusters when they're located too. Everything without
 * coordinates falls back to rank-interleaved round-robin, which keeps quality
 * balanced across days (pool arrives sorted by preference score).
 */

import {
  ResearchResult,
  AttractionData,
  RestaurantData,
  ActivityData,
  DayPlan,
  ScheduledItem,
} from './types';
import { haversineKm, LatLng } from '@/lib/itinerary/geo';
import { dedupeKey } from '../provenance';

export interface DayPool {
  attractions: AttractionData[];
  restaurants: RestaurantData[];
  activities: ActivityData[];
}

interface MaybeLocated {
  coordinates?: LatLng;
}

function hasCoords(item: MaybeLocated): boolean {
  return (
    !!item.coordinates &&
    Number.isFinite(item.coordinates.lat) &&
    Number.isFinite(item.coordinates.lng)
  );
}

/**
 * Rank-interleaved split: item i goes to day i % days. Input is assumed
 * sorted best-first (curation output is), so every day gets a comparable
 * quality spread instead of day 1 taking all the top picks.
 */
export function roundRobin<T>(items: T[], days: number): T[][] {
  const out: T[][] = Array.from({ length: days }, () => []);
  items.forEach((item, i) => out[i % days].push(item));
  return out;
}

/** Minimum fraction of items that must carry coordinates to geo-cluster. */
const GEO_COVERAGE_THRESHOLD = 0.6;

/**
 * Group items into `days` geographic clusters via farthest-point seeding +
 * nearest-seed assignment with a size cap. Deterministic and cheap — this is
 * "put Brooklyn on one day and Midtown on another", not optimal k-means.
 *
 * Returns null when there isn't enough coordinate coverage to cluster
 * meaningfully; callers fall back to round-robin.
 */
export function clusterByProximity<T extends MaybeLocated>(
  items: T[],
  days: number
): T[][] | null {
  const located = items.filter(hasCoords);
  if (
    days < 2 ||
    located.length < days * 2 ||
    located.length / Math.max(items.length, 1) < GEO_COVERAGE_THRESHOLD
  ) {
    return null;
  }

  // Farthest-point seeding: spread the day anchors across the map.
  const seeds: T[] = [located[0]];
  while (seeds.length < days) {
    let best: T | undefined;
    let bestDist = -1;
    for (const item of located) {
      if (seeds.includes(item)) continue;
      const d = Math.min(
        ...seeds.map((s) => haversineKm(s.coordinates!, item.coordinates!))
      );
      if (d > bestDist) {
        bestDist = d;
        best = item;
      }
    }
    if (!best) break;
    seeds.push(best);
  }
  if (seeds.length < days) return null;

  const cap = Math.ceil(items.length / days);
  const clusters: T[][] = seeds.map((s) => [s]);
  const assigned = new Set<T>(seeds);

  for (const item of located) {
    if (assigned.has(item)) continue;
    const byDistance = seeds
      .map((seed, idx) => ({
        idx,
        d: haversineKm(seed.coordinates!, item.coordinates!),
      }))
      .sort((a, b) => a.d - b.d);
    const target =
      byDistance.find((o) => clusters[o.idx].length < cap) ?? byDistance[0];
    clusters[target.idx].push(item);
    assigned.add(item);
  }

  // Items without coordinates: balance them into the smallest clusters.
  for (const item of items) {
    if (assigned.has(item) || hasCoords(item)) continue;
    const idx = clusters.reduce(
      (min, c, i) => (c.length < clusters[min].length ? i : min),
      0
    );
    clusters[idx].push(item);
  }

  return clusters;
}

function centroidOf(items: MaybeLocated[]): LatLng | null {
  const coords = items.filter(hasCoords).map((i) => i.coordinates!);
  if (coords.length === 0) return null;
  return {
    lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
    lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
  };
}

/**
 * Assign located items to the nearest cluster centroid (with a size cap so one
 * dense neighborhood doesn't starve the other days); unlocated items
 * round-robin into the smallest buckets.
 */
function assignToCentroids<T extends MaybeLocated>(
  items: T[],
  centroids: (LatLng | null)[]
): T[][] {
  const days = centroids.length;
  const out: T[][] = Array.from({ length: days }, () => []);
  const cap = Math.ceil(items.length / days);

  for (const item of items) {
    let idx: number | undefined;
    if (hasCoords(item)) {
      const byDistance = centroids
        .map((c, i) => ({ i, d: c ? haversineKm(c, item.coordinates!) : Infinity }))
        .sort((a, b) => a.d - b.d);
      idx = (byDistance.find((o) => out[o.i].length < cap) ?? byDistance[0]).i;
    }
    if (idx === undefined || !Number.isFinite(idx)) {
      idx = out.reduce((min, b, i) => (b.length < out[min].length ? i : min), 0);
    }
    out[idx].push(item);
  }
  return out;
}

/**
 * Split the curated pool into one disjoint DayPool per trip day.
 * Attractions geo-cluster when coverage allows; restaurants follow the
 * attraction clusters when both sides are located; everything else
 * round-robins by rank.
 */
export function partitionResearchAcrossDays(
  research: ResearchResult,
  days: number
): { pools: DayPool[]; geoClustered: boolean } {
  if (days <= 1) {
    return {
      pools: [
        {
          attractions: research.attractions ?? [],
          restaurants: research.restaurants ?? [],
          activities: research.activities ?? [],
        },
      ],
      geoClustered: false,
    };
  }

  const attractionClusters = clusterByProximity(research.attractions ?? [], days);
  const geoClustered = attractionClusters !== null;
  const attractions = attractionClusters ?? roundRobin(research.attractions ?? [], days);

  let restaurants: RestaurantData[][];
  if (geoClustered) {
    const centroids = attractions.map(centroidOf);
    restaurants = assignToCentroids(research.restaurants ?? [], centroids);
  } else {
    restaurants = roundRobin(research.restaurants ?? [], days);
  }

  const activities = roundRobin(research.activities ?? [], days);

  return {
    pools: Array.from({ length: days }, (_, i) => ({
      attractions: attractions[i] ?? [],
      restaurants: restaurants[i] ?? [],
      activities: activities[i] ?? [],
    })),
    geoClustered,
  };
}

// ─── Post-dedup refill ───────────────────────────────────────────────────────

type Bucket = 'morning' | 'afternoon' | 'evening';

const BUCKET_DEFAULT_TIME: Record<Bucket, string> = {
  morning: '10:00',
  afternoon: '14:00',
  evening: '19:00',
};

function toScheduledItem(
  candidate: AttractionData | RestaurantData | ActivityData,
  type: ScheduledItem['type'],
  bucket: Bucket
): ScheduledItem {
  const duration =
    'estimatedDuration' in candidate
      ? candidate.estimatedDuration
      : 'duration' in candidate
        ? candidate.duration
        : 90;
  const description =
    'description' in candidate
      ? candidate.description
      : 'mustTry' in candidate && candidate.mustTry
        ? `Known for: ${candidate.mustTry}`
        : undefined;
  return {
    time: BUCKET_DEFAULT_TIME[bucket],
    name: candidate.name,
    type,
    duration: Math.min(Math.max(duration || 90, 15), 360),
    description,
  };
}

/**
 * Fill an empty day bucket from the day's unused pool candidates. Evenings
 * prefer a restaurant (dinner), mornings/afternoons prefer attractions then
 * activities. Marks the picked name in `used` so a later bucket/day can't
 * reuse it. Returns the refill item or null when the pool has nothing left.
 */
export function refillBucket(
  bucket: Bucket,
  pool: DayPool,
  used: Set<string>
): ScheduledItem | null {
  const unused = <T extends { name: string }>(items: T[]): T | undefined =>
    items.find((i) => !used.has(dedupeKey(i.name)));

  const order: Array<
    [ScheduledItem['type'], Array<AttractionData | RestaurantData | ActivityData>]
  > =
    bucket === 'evening'
      ? [
          ['restaurant', pool.restaurants],
          ['activity', pool.activities],
          ['attraction', pool.attractions],
        ]
      : [
          ['attraction', pool.attractions],
          ['activity', pool.activities],
          ['restaurant', pool.restaurants],
        ];

  for (const [type, items] of order) {
    const candidate = unused(items);
    if (candidate) {
      used.add(dedupeKey(candidate.name));
      return toScheduledItem(candidate, type, bucket);
    }
  }
  return null;
}

// ─── Model-free day assembly ─────────────────────────────────────────────────

/**
 * Build a complete day from a pool with no model involved.
 *
 * This is the safety net for a failed day build: days are planned in parallel,
 * and before this existed a single malformed model response rejected the whole
 * `Promise.all` and killed the entire generation. Filling each bucket from the
 * day's own (already geo-clustered) pool produces a plainer day than the model
 * would — no narrative, no tips — but it is real, researched places in a
 * sensible order, which is a far better failure mode than nothing.
 *
 * `refillBucket` picks by bucket-appropriate type, so morning/afternoon lead
 * with attractions and evening leads with a restaurant.
 */
export function buildFallbackDay(
  dayNumber: number,
  theme: string,
  pool: DayPool
): DayPlan {
  const used = new Set<string>();
  const fill = (bucket: Bucket, count: number): ScheduledItem[] => {
    const items: ScheduledItem[] = [];
    for (let i = 0; i < count; i++) {
      const item = refillBucket(bucket, pool, used);
      if (!item) break;
      items.push(item);
    }
    return items;
  };

  return {
    dayNumber,
    // Overwritten by the caller with the real calendar date.
    date: new Date().toISOString().split('T')[0],
    theme,
    morning: fill('morning', 2),
    afternoon: fill('afternoon', 2),
    evening: fill('evening', 2),
    notes: 'Assembled from researched places after the planner failed on this day.',
    estimatedCost: '$$$',
  };
}
