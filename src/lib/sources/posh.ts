/**
 * Posh connector — posh.vip explore API.
 *
 * Recon (verified live 2026-09-02): GET
 * https://posh.vip/api/bff/v1/explore/events?lat=&lng=&timezone=&cursor=<n>
 * is plain HTTP, no auth, cursor-paginated (cursor looks like an offset).
 * The exact response shape is not guaranteed, so the parser locates the
 * events array flexibly and normalizes each item defensively.
 */

import { politeFetchJson, politeFetchText } from './polite-fetch';
import { extractStructuredEvents, normalizePoshStructuredEvent } from './structured-event';
import { eventDetails, sourceTime, sourceEnd, sourceUrl } from './normalize';
import {
  RawCandidateSchema,
  type EventSource,
  type RawCandidate,
  type SourceFetchOptions,
} from './types';

const EXPLORE_URL = 'https://posh.vip/api/bff/v1/explore/events';
const MAX_PAGES = 5;
const PAGE_SIZE = 25;
const LAT = 40.7128;
const LNG = -74.006;
const TIMEZONE = 'America/New_York';
// Identify the actual server client. No browser session or challenge credentials are used.
const FETCH_OPTIONS = {
  headers: { 'User-Agent': 'Spotz/1.0 (+https://spotz-xi.vercel.app)' },
};

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

/** Normalize one API event into a validated RawCandidate, or null. */
export function normalizeEvent(item: unknown): RawCandidate | null {
  if (!isRecord(item)) return null;
  const e = item;

  const slug = asString(e.slug) ?? asString(e.url);
  const id = asString(e.id) ?? slug;
  const title = asString(e.title) ?? asString(e.name);
  if (!id || !title) return null;

  const venue = isRecord(e.venue) ? e.venue : undefined;
  const venueName =
    asString(e.venueName) ??
    asString(venue?.name) ??
    (venue === undefined ? asString(e.venue) : undefined) ??
    asString(venue?.title);
  const address = asString(e.address) ?? asString(venue?.address);
  const lat =
    asNumber(venue?.latitude) ?? asNumber(venue?.lat) ?? asNumber(e.latitude) ?? asNumber(e.lat);
  const lng =
    asNumber(venue?.longitude) ?? asNumber(venue?.lng) ?? asNumber(e.longitude) ?? asNumber(e.lng);

  const start = e.startDate ?? e.startsAt ?? e.starts_at;
  const end = e.endDate ?? e.endAt ?? e.ends_at;
  const startsAt = sourceTime(start);
  const endsAt = sourceEnd(start, end);

  const priceMin = asNumber(e.minTicketPrice) ?? asNumber(e.priceMin);
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
    sourceUrl: sourceUrl(slug, 'https://posh.vip/e/', ['posh.vip']),
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
    details: eventDetails({
      title,
      description: asString(e.description),
      tags,
      startsAt: start,
      endsAt: end,
      status: e.status,
      cancelled: e.isCancelled ?? e.isCanceled,
      availability: e.ticketStatus,
      soldOut: e.isSoldOut,
      locationVisibility: venueName || address ? 'public' : 'unknown',
      currency:
        typeof e.currency === 'string' && /^[A-Z]{3}$/.test(e.currency) ? e.currency : undefined,
    }),
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

  async fetchCandidates(options: SourceFetchOptions = {}): Promise<RawCandidate[]> {
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
        data = await politeFetchJson<unknown>(url, FETCH_OPTIONS);
        const envelope = isRecord(data) ? data : {};
        if (
          ![
            envelope.events,
            envelope.data,
            envelope.results,
            envelope.items,
            isRecord(envelope.data) ? envelope.data.events : undefined,
          ].some(Array.isArray)
        ) {
          throw new Error('[posh] explore response has no events array');
        }
      } catch (err) {
        // A first-page failure means the whole source is down — there is
        // nothing to salvage, and returning [] would report as "no events
        // tonight" instead of an outage. Later pages degrade gracefully.
        if (page === 0) throw err;
        console.warn('[posh] explore fetch failed on page', page, err);
        options.onWarning?.(`Page ${page + 1} failed; coverage is partial.`);
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
      if (newOnPage === 0) {
        if (out.length === 0) throw new Error('[posh] no usable events on first nonempty page');
        break;
      }

      if (isRecord(data) && 'nextCursor' in data && data.nextCursor === null) break;
      const next = extractNextCursor(data, cursor, events.length);
      if (next === cursor) break;
      cursor = next;
    }

    // Bounded, opt-in page enrichment; no arbitrary URLs and no access bypass.
    if (process.env.SOURCE_POSH_DETAILS_ENABLED === 'true') {
      for (let i = 0; i < Math.min(out.length, 12); i++) {
        const candidate = out[i];
        if (!candidate.sourceUrl) continue;
        try {
          const html = await politeFetchText(candidate.sourceUrl, FETCH_OPTIONS);
          const event = extractStructuredEvents(html)
            .map((e) => normalizePoshStructuredEvent(e, candidate.sourceId))
            .find((e) => e?.sourceUrl === candidate.sourceUrl);
          if (!event) {
            options.onWarning?.(`No structured details for ${candidate.sourceId}.`);
            continue;
          }
          if (
            candidate.startsAt &&
            event.startsAt &&
            Date.parse(candidate.startsAt) !== Date.parse(event.startsAt)
          )
            event.details?.issues.push(
              'Discovery and detail page disagree on start time; showing the detail page time.'
            );
          out[i] = {
            ...event,
            hype: candidate.hype,
            tags: candidate.tags,
            raw: { discovery: candidate.raw, detail: event.raw },
          };
        } catch {
          options.onWarning?.('Detail refresh failed; remaining page enrichment skipped.');
          break;
        }
      }
    }
    return out;
  },
};
