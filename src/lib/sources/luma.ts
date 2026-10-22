import { politeFetchJson } from './polite-fetch';
import { EventSource, RawCandidate, RawCandidateSchema, type SourceFetchOptions } from './types';
import { record, text, number, sourceTime, sourceEnd, sourceUrl, eventDetails } from './normalize';

/** Undocumented discovery API, distinct from the calendar-scoped official API. */
export const LUMA_PLACE_ID = 'discplace-Izx1rQVSh8njYpP';
const DISCOVER_URL = 'https://api.lu.ma/discover/get-paginated-events';
const MAX_PAGES = 6;

export function normalizeLumaEntry(value: unknown): RawCandidate | null {
  const entry = record(value);
  if (!entry) return null;
  const event = record(entry.event) ?? entry;
  const pick = (key: string) => event[key] ?? entry[key];
  const sourceId = text(pick('api_id')),
    title = text(pick('name'));
  if (!sourceId || !title) return null;
  const geo = record(pick('geo_address_info'));
  const hidden = pick('geo_address_visibility') === 'guests-only' || geo?.mode === 'obfuscated';
  const coordinate = hidden ? undefined : record(pick('coordinate'));
  const ticket = record(pick('ticket_info'));
  const tags = Array.isArray(pick('tags'))
    ? (pick('tags') as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  if (ticket?.free === true || ticket?.is_free === true) tags.push('isFree');
  if (text(ticket?.type)) tags.push(`ticket:${text(ticket?.type)}`);
  const address = hidden ? undefined : (text(geo?.full_address) ?? text(geo?.address));
  // A city is a useful area, but is not a venue. Hidden coordinates stay hidden.
  const area =
    [
      ...new Set(
        [text(geo?.sublocality), text(geo?.city_state) ?? text(geo?.city)].filter(Boolean)
      ),
    ].join(', ') || undefined;
  const hype: Record<string, unknown> = {};
  for (const [key, field] of [
    ['guestCount', 'guest_count'],
    ['ticketCount', 'ticket_count'],
  ]) {
    const n = number(pick(field));
    if (n !== undefined) hype[key] = n;
  }
  // Observed 2026-10-22: price is { cents: 1000, currency: 'usd', is_flexible: false }.
  // Only USD is verified here; do not impose a two-decimal exponent on other currencies.
  const price = record(ticket?.price),
    maxPrice = record(ticket?.max_price);
  const usd = text(price?.currency)?.toLowerCase() === 'usd';
  const cents = number(price?.cents),
    maxCents = number(maxPrice?.cents);
  const candidate = {
    source: 'luma',
    sourceId,
    sourceUrl: sourceUrl(pick('url'), 'https://lu.ma/', ['lu.ma', 'luma.com']),
    title,
    description: text(pick('description')),
    startsAt: sourceTime(pick('start_at')),
    endsAt: sourceEnd(pick('start_at'), pick('end_at')),
    venueName: hidden ? undefined : (text(geo?.place_name) ?? text(geo?.name)),
    address,
    lat: number(coordinate?.latitude),
    lng: number(coordinate?.longitude),
    priceMin: usd && cents !== undefined && cents >= 0 ? cents / 100 : undefined,
    priceMax:
      text(maxPrice?.currency)?.toLowerCase() === 'usd' &&
      usd &&
      maxCents !== undefined &&
      maxCents >= 0
        ? maxCents / 100
        : undefined,
    isFree:
      typeof ticket?.is_free === 'boolean'
        ? ticket.is_free
        : typeof ticket?.free === 'boolean'
          ? ticket.free
          : undefined,
    details: eventDetails({
      title,
      description: text(pick('description')),
      tags,
      startsAt: pick('start_at'),
      endsAt: pick('end_at'),
      status: pick('status'),
      cancelled: pick('is_cancelled') ?? pick('is_canceled'),
      soldOut: ticket?.is_sold_out,
      approval: ticket?.require_approval,
      availability: ticket?.availability,
      // waitlist_enabled is configuration, NOT evidence that admission is waitlisted.
      available:
        number(ticket?.spots_remaining) !== undefined && number(ticket?.spots_remaining)! > 0,
      neighborhood: area,
      locationVisibility: hidden ? 'approximate' : address ? 'public' : 'unknown',
      venueId: !hidden && text(geo?.place_id) ? `google:${text(geo?.place_id)}` : undefined,
      currency: usd ? 'USD' : undefined,
      priceNotes:
        price?.is_flexible === true
          ? 'Source lists flexible pricing; confirm the amount at registration.'
          : undefined,
    }),
    hype,
    tags,
    raw: value,
  };
  const parsed = RawCandidateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export const lumaSource: EventSource = {
  name: 'luma',
  enabled: () => process.env.SOURCE_LUMA_ENABLED !== 'false',
  async fetchCandidates(options: SourceFetchOptions = {}) {
    if (!this.enabled()) return [];
    const candidates: RawCandidate[] = [];
    const seenIds = new Set<string>(),
      cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(DISCOVER_URL);
      url.searchParams.set(
        'discover_place_api_id',
        process.env.SOURCE_LUMA_PLACE_ID || LUMA_PLACE_ID
      );
      url.searchParams.set('pagination_limit', '25');
      if (cursor) url.searchParams.set('pagination_cursor', cursor);
      let data: Record<string, unknown> | undefined;
      try {
        data = record(await politeFetchJson(url.toString()));
        if (!Array.isArray(data?.entries))
          throw new Error('[luma] discovery response has no entries array');
      } catch (error) {
        if (page === 0) throw error;
        console.warn('[luma] partial discovery at page', page, error);
        options.onWarning?.(`Page ${page + 1} failed; coverage is partial.`);
        break;
      }
      for (const entry of data!.entries as unknown[]) {
        const normalized = normalizeLumaEntry(entry);
        if (!normalized || seenIds.has(normalized.sourceId)) continue;
        seenIds.add(normalized.sourceId);
        candidates.push(normalized);
      }
      if (page === 0 && (data!.entries as unknown[]).length > 0 && candidates.length === 0)
        throw new Error('[luma] no usable events on first nonempty page');
      if (!data?.has_more) break;
      cursor = text(data.next_cursor);
      if (!cursor || cursors.has(cursor)) {
        options.onWarning?.('Pagination cursor missing or repeated; coverage is partial.');
        break;
      }
      cursors.add(cursor);
    }
    return candidates;
  },
};
