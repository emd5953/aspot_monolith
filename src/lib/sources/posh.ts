/**
 * Posh connector — posh.vip explore API.
 *
 * Recon (verified live 2026-09-02): GET
 * https://posh.vip/api/bff/v1/explore/events?lat=&lng=&timezone=&cursor=<n>
 * is plain HTTP, no auth, cursor-paginated (cursor looks like an offset).
 * The exact response shape is not guaranteed, so the parser locates the
 * events array flexibly and normalizes each item defensively.
 */

import { z } from 'zod';
import { politeFetchJson } from './polite-fetch';
import { RawCandidateSchema, type EventSource, type RawCandidate } from './types';

const EXPLORE_URL = 'https://posh.vip/api/bff/v1/explore/events';
const MAX_PAGES = 5;
const PAGE_SIZE = 25;
const LAT = 40.7128;
const LNG = -74.006;
const TIMEZONE = 'America/New_York';

/** Every field optional/unknown — the shape is not guaranteed. */
const eventSchema = z
  .object({
    id: z.unknown().optional(),
    slug: z.unknown().optional(),
    title: z.unknown().optional(),
    name: z.unknown().optional(),
    description: z.unknown().optional(),
    startsAt: z.unknown().optional(),
    starts_at: z.unknown().optional(),
    endAt: z.unknown().optional(),
    ends_at: z.unknown().optional(),
    venue: z.unknown().optional(),
    address: z.unknown().optional(),
    latitude: z.unknown().optional(),
    longitude: z.unknown().optional(),
    lat: z.unknown().optional(),
    lng: z.unknown().optional(),
    priceMin: z.unknown().optional(),
    priceMax: z.unknown().optional(),
    isFree: z.unknown().optional(),
    attendingCount: z.unknown().optional(),
    attending_count: z.unknown().optional(),
    guestCount: z.unknown().optional(),
    tags: z.unknown().optional(),
  })
  .passthrough();

type PoshEvent = z.infer<typeof eventSchema>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Pull the events array out of whatever envelope the BFF wraps it in. */
export function extractEvents(data: unknown): unknown[] {
  if (!isRecord(data)) return [];
  if (Array.isArray(data.events)) return data.events;
  if (isRecord(data.data)) {
    if (Array.isArray(data.data.events)) return data.data.events;
  }
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

/** Read a next-cursor from the response, or fall back to offset stepping. */
function extractNextCursor(data: unknown, currentCursor: number, pageLength: number): number {
  if (isRecord(data)) {
    const objs: Record<string, unknown>[] = [data];
    if (isRecord(data.data)) objs.push(data.data);
    for (const obj of objs) {
      for (const key of ['nextCursor', 'next_cursor', 'cursor', 'nextOffset']) {
        const v = obj[key];
        if (typeof v === 'number' && Number.isFinite(v) && v !== currentCursor) return v;
        if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) {
          const n = Number(v);
          if (n !== currentCursor) return n;
        }
      }
    }
  }
  // Offset-style fallback: advance by what this page actually returned. The
  // request never sends a page-size parameter, so assuming PAGE_SIZE would
  // skip or re-fetch events whenever the BFF picks a different size.
  return currentCursor + (pageLength > 0 ? pageLength : PAGE_SIZE);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** ISO string with timezone offset (matches z.datetime({ offset: true })). */
function asIsoWithOffset(v: unknown): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    // Already offset-aware; canonicalize Z and drop a zero-milliseconds fraction.
    const normalized = s.endsWith('Z') ? `${s.slice(0, -1)}+00:00` : s;
    return normalized.replace(/\.000(?=(?:[+-]\d{2}:?\d{2})?$)/, '');
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/** Normalize one API event into a validated RawCandidate, or null. */
export function normalizeEvent(item: unknown): RawCandidate | null {
  const parsed = eventSchema.safeParse(item);
  if (!parsed.success) return null;
  const e: PoshEvent = parsed.data;

  const slug = asString(e.slug);
  const id = asString(e.id) ?? slug;
  const title = asString(e.title) ?? asString(e.name);
  if (!id || !title) return null;

  const venue = isRecord(e.venue) ? e.venue : undefined;
  const venueName = asString(venue?.name) ?? (venue === undefined ? asString(e.venue) : undefined) ?? asString(venue?.title);
  const address = asString(e.address) ?? asString(venue?.address);
  const lat =
    asNumber(venue?.latitude) ?? asNumber(venue?.lat) ?? asNumber(e.latitude) ?? asNumber(e.lat);
  const lng =
    asNumber(venue?.longitude) ??
    asNumber(venue?.lng) ??
    asNumber(e.longitude) ??
    asNumber(e.lng);

  const startsAt = asIsoWithOffset(e.startsAt) ?? asIsoWithOffset(e.starts_at);
  const endsAt = asIsoWithOffset(e.endAt) ?? asIsoWithOffset(e.ends_at);

  const priceMin = asNumber(e.priceMin);
  const priceMax = asNumber(e.priceMax);
  const isFree = typeof e.isFree === 'boolean' ? e.isFree : undefined;

  const hype: Record<string, unknown> = {};
  const attending =
    asNumber(e.attendingCount) ?? asNumber(e.attending_count) ?? asNumber(e.guestCount);
  if (attending !== undefined) hype['attending'] = attending;

  const tags = Array.isArray(e.tags)
    ? e.tags.filter((t): t is string => typeof t === 'string')
    : [];

  const candidate = {
    source: 'posh' as const,
    sourceId: id,
    sourceUrl: slug ? `https://posh.vip/e/${slug}` : undefined,
    title,
    description: asString(e.description),
    startsAt,
    endsAt,
    venueName,
    address,
    lat,
    lng,
    priceMin,
    priceMax,
    isFree,
    hype,
    tags,
    raw: item,
  };
  const validated = RawCandidateSchema.safeParse(candidate);
  return validated.success ? validated.data : null;
}

export const poshSource: EventSource = {
  name: 'posh',

  enabled(): boolean {
    return process.env.SOURCE_POSH_ENABLED !== 'false';
  },

  async fetchCandidates(): Promise<RawCandidate[]> {
    if (!this.enabled()) return [];

    const out: RawCandidate[] = [];
    const seenIds = new Set<string>();
    let cursor = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${EXPLORE_URL}?lat=${LAT}&lng=${LNG}&timezone=${encodeURIComponent(
        TIMEZONE
      )}&cursor=${cursor}`;

      let data: unknown;
      try {
        data = await politeFetchJson<unknown>(url);
      } catch (err) {
        // A first-page failure means the whole source is down — there is
        // nothing to salvage, and returning [] would report as "no events
        // tonight" instead of an outage. Later pages degrade gracefully.
        if (page === 0) throw err;
        console.warn('[posh] explore fetch failed on page', page, err);
        break;
      }

      const events = extractEvents(data);
      if (events.length === 0) break; // empty page -> stop

      let newOnPage = 0;
      for (const item of events) {
        const normalized = normalizeEvent(item);
        if (!normalized) continue; // invalid -> skip
        if (seenIds.has(normalized.sourceId)) continue;
        seenIds.add(normalized.sourceId);
        out.push(normalized);
        newOnPage++;
      }

      // Repeated page (nothing fresh) -> stop.
      if (newOnPage === 0) break;

      const next = extractNextCursor(data, cursor, events.length);
      if (next === cursor) break;
      cursor = next;
    }

    return out;
  },
};
