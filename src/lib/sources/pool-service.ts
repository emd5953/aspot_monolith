import { SupabaseClient } from '@supabase/supabase-js';
import { nycDate, nycNightDate, nycTimeToUtc } from '@/lib/time/nyc';
import { RawCandidate, isInNyc, EventDetailsSchema, type EventDetails } from './types';

/**
 * Pool persistence: upsert candidates from connectors into `candidate_events`,
 * dedupe cross-source duplicates, expire past events, and serve tonight's pool
 * to the generator. Connectors never touch the DB; this module owns it.
 */

export interface PoolCandidateRow {
  id: string;
  source: string;
  source_id: string;
  source_url: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean | null;
  details?: EventDetails;
  /** Read-time cross-list evidence; never persisted over the original source row. */
  listings?: Array<{ source: string; url: string; fetchedAt: string }>;
  conflicts?: string[];
  hype: Record<string, unknown>;
  tags: string[];
  fetched_at: string;
  expires_at: string | null;
}

export function candidateToRow(c: RawCandidate, now = new Date()) {
  return {
    source: c.source,
    source_id: c.sourceId,
    source_url: c.sourceUrl ?? null,
    title: c.title,
    description: c.description ?? null,
    starts_at: c.startsAt ?? null,
    ends_at: c.endsAt ?? null,
    venue_name: c.venueName ?? null,
    address: c.address ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    price_min: c.priceMin ?? null,
    price_max: c.priceMax ?? null,
    is_free: c.isFree ?? null,
    details: c.details ?? EventDetailsSchema.parse({}),
    hype: c.hype ?? {},
    tags: c.tags ?? [],
    raw: c.raw ?? {},
    fetched_at: now.toISOString(),
    // Storage expiry only: published end, start + 12h, or one day for undated rows.
    expires_at:
      c.endsAt ??
      (c.startsAt
        ? new Date(new Date(c.startsAt).getTime() + 12 * 3600_000).toISOString()
        : new Date(now.getTime() + 24 * 3600_000).toISOString()),
    updated_at: now.toISOString(),
  };
}

/** Geo-filter to NYC, then upsert on (source, source_id). Returns count written. */
export async function upsertCandidates(
  supabase: SupabaseClient,
  candidates: RawCandidate[]
): Promise<number> {
  const unique = new Map(candidates.map((c) => [`${c.source}:${c.sourceId}`, c]));
  const rows = [...unique.values()]
    .filter((c) => isInNyc(c.lat, c.lng))
    .map((c) => candidateToRow(c));
  if (rows.length === 0) return 0;

  const { error, count } = await supabase
    .from('candidate_events')
    .upsert(rows, { onConflict: 'source,source_id', count: 'exact' });

  if (error) throw new Error(`pool upsert failed: ${error.message}`);
  return count ?? rows.length;
}

/** Delete expired candidates. Returns count removed. */
export async function expireCandidates(supabase: SupabaseClient): Promise<number> {
  const { error, count } = await supabase
    .from('candidate_events')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString());
  if (error) throw new Error(`pool expiry failed: ${error.message}`);
  return count ?? 0;
}

/** Source preference breaks equal-freshness ties, after conservative identity matching. */
const SOURCE_PRIORITY: Record<string, number> = {
  partiful: 5,
  posh: 4,
  luma: 3,
  tiktok: 2,
  places: 1,
  manual: 6,
};

export function normalizeDedupeKey(title: string, startsAt?: string | null): string {
  const instant = startsAt ? new Date(startsAt) : null;
  const day = instant && Number.isFinite(instant.getTime()) ? nycDate(instant) : 'undated';
  return `${day}::${normalizeIdentity(title)}`;
}

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type DedupeRow = Pick<PoolCandidateRow, 'title' | 'starts_at' | 'source'> &
  Partial<PoolCandidateRow>;

/** Conservative venue matching: shared verified id, street address, or name.
 * Conflicting coordinates/addresses defeat a same-name match (chain venues).
 */
export function sameVenue(a: DedupeRow, b: DedupeRow): boolean {
  const idA = a.details?.venueId,
    idB = b.details?.venueId;
  if (idA && idB) return idA === idB;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const meters = Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 84000);
    if (meters > 200) return false;
  }
  if (a.address && b.address) return normalizeIdentity(a.address) === normalizeIdentity(b.address);
  return Boolean(
    a.venue_name &&
    b.venue_name &&
    normalizeIdentity(a.venue_name) === normalizeIdentity(b.venue_name)
  );
}

function sameEvent(a: DedupeRow, b: DedupeRow): boolean {
  if (a.source === b.source && a.source_id && a.source_id === b.source_id) return true;
  if (a.source_url && a.source_url === b.source_url) return true;
  if (a.source === b.source && a.source_id && b.source_id && a.source_id !== b.source_id)
    return false;
  if (!a.starts_at || !b.starts_at || !sameVenue(a, b)) return false;
  const delta = Math.abs(Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return delta <= 90 * 60_000 && normalizeIdentity(a.title) === normalizeIdentity(b.title);
}

export function dedupeRows<T extends DedupeRow>(rows: T[]): T[] {
  // Newest evidence first, source preference only breaks equal-time ties.
  const sorted = [...rows].sort(
    (a, b) =>
      (Date.parse(b.fetched_at ?? '') || 0) - (Date.parse(a.fetched_at ?? '') || 0) ||
      (SOURCE_PRIORITY[b.source] ?? 0) - (SOURCE_PRIORITY[a.source] ?? 0) ||
      (a.source_id ?? a.title).localeCompare(b.source_id ?? b.title)
  );
  const groups: T[][] = [];
  for (const row of sorted) {
    const group = groups.find((g) => sameEvent(g[0], row));
    if (group) group.push(row);
    else groups.push([row]);
  }
  return groups.map((group) => {
    const winner = group[0];
    const conflicts = new Set(winner.conflicts ?? []);
    for (const other of group.slice(1)) {
      for (const field of ['starts_at', 'ends_at', 'price_min', 'price_max'] as const) {
        if (
          winner[field] != null &&
          other[field] != null &&
          String(winner[field]) !== String(other[field])
        ) {
          // Different offsets representing the same instant are not a conflict.
          if (
            field.endsWith('_at') &&
            Date.parse(String(winner[field])) === Date.parse(String(other[field]))
          )
            continue;
          conflicts.add(`Sources disagree about ${field.replaceAll('_', ' ')}; check the listing.`);
        }
      }
      if (
        winner.details?.status &&
        other.details?.status &&
        winner.details.status !== 'unknown' &&
        other.details.status !== 'unknown' &&
        winner.details.status !== other.details.status
      )
        conflicts.add('Sources disagree about event status.');
      if (
        winner.details?.availability &&
        other.details?.availability &&
        winner.details.availability !== 'unknown' &&
        other.details.availability !== 'unknown' &&
        winner.details.availability !== other.details.availability
      )
        conflicts.add('Sources disagree about ticket availability.');
    }
    // A fresh cancellation must not vanish behind another platform's active copy.
    const restricted = group.find((r) =>
      ['cancelled', 'postponed'].includes(r.details?.status ?? '')
    );
    const unavailable = group.find((r) =>
      ['sold_out', 'registration_closed'].includes(r.details?.availability ?? '')
    );
    // The shared reader and a transport may both dedupe. Preserve already
    // aggregated provenance instead of shrinking it back to the winning URL.
    const listings = new Map<string, { source: string; url: string; fetchedAt: string }>();
    for (const row of group) {
      const evidence = row.listings?.length
        ? row.listings
        : row.source_url
          ? [{ source: row.source, url: row.source_url, fetchedAt: row.fetched_at ?? '' }]
          : [];
      for (const item of evidence) {
        const key = `${item.source}:${item.url}`;
        const previous = listings.get(key);
        if (!previous || item.fetchedAt > previous.fetchedAt) listings.set(key, item);
      }
    }
    return {
      ...winner,
      details: EventDetailsSchema.parse({
        ...winner.details,
        ...(restricted ? { status: restricted.details!.status } : {}),
        ...(unavailable ? { availability: unavailable.details!.availability } : {}),
      }),
      listings: [...listings.values()],
      conflicts: [...conflicts],
    };
  });
}

export const MAX_SOURCE_AGE_MS = 24 * 3600_000;

export function isFresh(row: PoolCandidateRow, now: Date): boolean {
  const age = now.getTime() - Date.parse(row.fetched_at);
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= MAX_SOURCE_AGE_MS;
}

export function isRecommendable(row: PoolCandidateRow, from: Date, to: Date, now: Date): boolean {
  if (!isFresh(row, now) || !row.starts_at || !row.source_url) return false;
  if (['cancelled', 'postponed'].includes(row.details?.status ?? '')) return false;
  if (['sold_out', 'registration_closed'].includes(row.details?.availability ?? '')) return false;
  const start = Date.parse(row.starts_at),
    end = row.ends_at ? Date.parse(row.ends_at) : NaN;
  // A long listing/series envelope is not evidence of an occurrence tonight.
  if (!Number.isFinite(start) || start < from.getTime() || start >= to.getTime()) return false;
  if (Number.isFinite(end) && (end <= now.getTime() || end <= start)) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) return false;
  // An ongoing event must have started in this night window and have a published end.
  return start >= now.getTime() || (Number.isFinite(end) && end > now.getTime());
}

export interface TonightPoolOptions {
  from?: Date;
  to?: Date;
  limit?: number;
  /** Injectable clock for replay; never supplied by a public route. */
  now?: Date;
}

/** Shared by itinerary generation and conversational discovery. No live scraping. */
export async function getTonightPool(
  supabase: SupabaseClient,
  opts: TonightPoolOptions = {}
): Promise<PoolCandidateRow[]> {
  const now = opts.now ?? new Date();
  const from = opts.from ?? nycTimeToUtc(nycNightDate(now), 0);
  const to = opts.to ?? nycTimeToUtc(nycDate(from), 30);
  const { data, error } = await supabase
    .from('candidate_events')
    .select(
      'id, source, source_id, source_url, title, description, starts_at, ends_at, venue_name, address, lat, lng, price_min, price_max, is_free, details, hype, tags, fetched_at, expires_at'
    )
    .gte('fetched_at', new Date(now.getTime() - MAX_SOURCE_AGE_MS).toISOString())
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 400);
  if (error) throw new Error(`pool read failed: ${error.message}`);
  const rows = (data ?? []).map((row) => ({
    ...row,
    details: EventDetailsSchema.parse(row.details ?? {}),
  })) as PoolCandidateRow[];
  return dedupeRows(rows.filter((row) => isFresh(row, now)))
    .filter((row) => isRecommendable(row, from, to, now))
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
}
