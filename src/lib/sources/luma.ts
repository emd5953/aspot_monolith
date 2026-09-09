/**
 * Luma source connector.
 *
 * Uses the public discover API (no auth):
 *   GET https://api.lu.ma/discover/get-paginated-events
 *       ?discover_place_api_id=<place>&pagination_cursor=<cursor>&pagination_limit=25
 *
 * Entries arrive loosely typed and the exact nesting varies; parse
 * defensively and hand anything we can normalize to `RawCandidate`.
 * Provenance rule: `raw` is the untouched entry from Luma.
 */

import { politeFetchJson } from './polite-fetch';
import { EventSource, RawCandidate, RawCandidateSchema } from './types';

/** NYC discover place id (verified 2026-09). Override via SOURCE_LUMA_PLACE_ID. */
export const LUMA_PLACE_ID = 'discplace-Izx1rQVSh8njYpP';

const DISCOVER_URL = 'https://api.lu.ma/discover/get-paginated-events';
const PAGE_LIMIT = 25;
const MAX_PAGES = 6;

/* eslint-disable @typescript-eslint/no-explicit-any -- source payloads are untyped by design */

type Entry = Record<string, any>;

/**
 * ISO-with-offset, matching `RawCandidateSchema`'s strict
 * `z.string().datetime({ offset: true })`. Luma's raw `start_at` is not always
 * in that shape, and because the whole candidate is safeParse'd as one object,
 * one off-format timestamp would drop the entire event rather than just its
 * date. Posh and Partiful normalize first for the same reason.
 */
function toIso(value: unknown): string | undefined {
  const s = asString(value);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Fields may sit directly on the entry or one level down under `event`. */
function pick(entry: Entry, key: string): any {
  const event = entry.event;
  if (event && typeof event === 'object' && event[key] !== undefined) return event[key];
  return entry[key];
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Luma's `url` field is a lu.ma slug (sometimes already a full URL). */
function toLumaUrl(value: unknown): string | undefined {
  const url = asString(value);
  if (!url) return undefined;
  if (url.startsWith('http')) {
    try {
      const slug = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
      return slug ? `https://lu.ma/${slug}` : undefined;
    } catch {
      return undefined;
    }
  }
  return `https://lu.ma/${url}`;
}

/** Build a best-effort venue name from whatever geo_address_info exposes. */
function venueFromGeoInfo(geo: unknown): string | undefined {
  if (!geo || typeof geo !== 'object') return undefined;
  const g = geo as Entry;
  const parts = [g.address, g.city, g.region, g.country]
    .map((p) => asString(p))
    .filter((p): p is string => p !== undefined);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function normalizeEntry(entry: Entry): RawCandidate | null {
  const sourceId = asString(pick(entry, 'api_id'));
  const title = asString(pick(entry, 'name'));
  if (!sourceId || !title) return null;

  const coordinate = entry.coordinate;
  const lat = asNumber(coordinate?.latitude);
  const lng = asNumber(coordinate?.longitude);

  const hype: Record<string, unknown> = {};
  const guestCount = asNumber(pick(entry, 'guest_count'));
  const ticketCount = asNumber(pick(entry, 'ticket_count'));
  if (guestCount !== undefined) hype.guestCount = guestCount;
  if (ticketCount !== undefined) hype.ticketCount = ticketCount;

  const tags: string[] = [];
  const ticketInfo = pick(entry, 'ticket_info');
  if (ticketInfo && typeof ticketInfo === 'object') {
    const info = ticketInfo as Entry;
    if (Array.isArray(info)) {
      for (const t of info) {
        if (t && typeof t === 'object' && asString((t as Entry).type)) {
          tags.push(`ticket:${asString((t as Entry).type)}`);
        }
      }
    } else {
      if (info.free === true || info.is_free === true) tags.push('isFree');
      const type = asString(info.type);
      if (type) tags.push(`ticket:${type}`);
    }
  }

  const candidate = {
    source: 'luma' as const,
    sourceId,
    sourceUrl: toLumaUrl(pick(entry, 'url')),
    title,
    description: asString(pick(entry, 'description')),
    startsAt: toIso(pick(entry, 'start_at')),
    endsAt: toIso(pick(entry, 'end_at')),
    venueName: venueFromGeoInfo(entry.geo_address_info),
    lat,
    lng,
    isFree: tags.includes('isFree') || undefined,
    hype,
    tags,
    raw: entry,
  };

  const parsed = RawCandidateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export const lumaSource: EventSource = {
  name: 'luma',

  enabled(): boolean {
    return process.env.SOURCE_LUMA_ENABLED !== 'false';
  },

  async fetchCandidates(): Promise<RawCandidate[]> {
    if (!this.enabled()) return [];

    const placeId = process.env.SOURCE_LUMA_PLACE_ID || LUMA_PLACE_ID;

    const candidates: RawCandidate[] = [];
    // Luma repeats entries across pages. An unnoticed duplicate makes
    // upsertCandidates send two rows with the same (source, source_id), and
    // Postgres rejects the WHOLE statement with "ON CONFLICT DO UPDATE command
    // cannot affect row a second time" — losing the entire batch, not the dupe.
    const seenIds = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(DISCOVER_URL);
      url.searchParams.set('discover_place_api_id', placeId);
      url.searchParams.set('pagination_limit', String(PAGE_LIMIT));
      if (cursor) url.searchParams.set('pagination_cursor', cursor);

      let data: Entry;
      try {
        data = await politeFetchJson<Entry>(url.toString());
      } catch (err) {
        // A first-page failure means the source is down; surface it rather
        // than reporting an empty night. Later pages keep what we collected.
        if (page === 0) throw err;
        console.warn('[luma] discover fetch failed on page', page, err);
        break;
      }

      const entries: Entry[] = Array.isArray(data?.entries) ? data.entries : [];

      for (const entry of entries) {
        const normalized = normalizeEntry(entry);
        if (!normalized) continue;
        if (seenIds.has(normalized.sourceId)) continue;
        seenIds.add(normalized.sourceId);
        candidates.push(normalized);
      }

      if (!data?.has_more) break;
      cursor = asString(data?.next_cursor);
      if (!cursor) break;
    }

    return candidates;
  },
};
