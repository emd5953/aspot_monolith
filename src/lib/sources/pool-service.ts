import { SupabaseClient } from '@supabase/supabase-js';
import { nycDate, nycTimeToUtc } from '@/lib/time/nyc';
import { RawCandidate, isInNyc } from './types';

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
  is_free: boolean;
  hype: Record<string, unknown>;
  tags: string[];
  fetched_at: string;
  expires_at: string | null;
}

function toRow(c: RawCandidate) {
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
    is_free: c.isFree ?? false,
    hype: c.hype ?? {},
    tags: c.tags ?? [],
    raw: c.raw ?? {},
    fetched_at: new Date().toISOString(),
    // Expire when the event ends; fall back to starts_at + 12h; else 7 days out.
    expires_at:
      c.endsAt ??
      (c.startsAt
        ? new Date(new Date(c.startsAt).getTime() + 12 * 3600_000).toISOString()
        : new Date(Date.now() + 7 * 24 * 3600_000).toISOString()),
    updated_at: new Date().toISOString(),
  };
}

/** Geo-filter to NYC, then upsert on (source, source_id). Returns count written. */
export async function upsertCandidates(
  supabase: SupabaseClient,
  candidates: RawCandidate[]
): Promise<number> {
  const rows = candidates.filter((c) => isInNyc(c.lat, c.lng)).map(toRow);
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

/**
 * Cross-source dedupe key: same night + same venue-ish name.
 * Kept intentionally simple and deterministic; LLM ranking downstream treats
 * duplicates as one. Returns candidates with duplicates (worse-provenance
 * source) filtered out. Priority: partiful > posh > luma > tiktok > places.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  partiful: 5,
  posh: 4,
  luma: 3,
  tiktok: 2,
  places: 1,
  manual: 6,
};

export function normalizeDedupeKey(title: string, startsAt?: string | null): string {
  const day = startsAt ? startsAt.slice(0, 10) : 'undated';
  const t = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return `${day}::${t}`;
}

export function dedupeRows<T extends { title: string; starts_at: string | null; source: string }>(
  rows: T[]
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = normalizeDedupeKey(row.title, row.starts_at);
    const existing = byKey.get(key);
    if (
      !existing ||
      (SOURCE_PRIORITY[row.source] ?? 0) > (SOURCE_PRIORITY[existing.source] ?? 0)
    ) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export interface TonightPoolOptions {
  /** Window start; defaults to now. */
  from?: Date;
  /** Window end; defaults to 6am tomorrow (America/New_York night runs late). */
  to?: Date;
  limit?: number;
}

/** Read tonight's candidates (plus undated evergreen spots), deduped. */
export async function getTonightPool(
  supabase: SupabaseClient,
  opts: TonightPoolOptions = {}
): Promise<PoolCandidateRow[]> {
  const from = opts.from ?? new Date();
  // 6am NYC the morning after `from`'s NYC date. Anchored to America/New_York
  // on purpose: setHours() would use the server's zone, and on Vercel (UTC)
  // that makes "6am" 1am ET, cutting five hours off the night.
  const to = opts.to ?? nycTimeToUtc(nycDate(from), 30);

  const { data, error } = await supabase
    .from('candidate_events')
    .select(
      'id, source, source_id, source_url, title, description, starts_at, ends_at, venue_name, address, lat, lng, price_min, price_max, is_free, hype, tags, fetched_at, expires_at'
    )
    .or(
      `and(starts_at.gte.${from.toISOString()},starts_at.lte.${to.toISOString()}),starts_at.is.null`
    )
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 400);

  if (error) throw new Error(`pool read failed: ${error.message}`);
  return dedupeRows((data ?? []) as PoolCandidateRow[]);
}
