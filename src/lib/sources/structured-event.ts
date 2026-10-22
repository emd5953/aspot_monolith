import { record, text, number, eventDetails, sourceTime, sourceEnd, sourceUrl } from './normalize';
import { RawCandidateSchema, type RawCandidate } from './types';

/** Parse data only. Never execute scripts from an event page. Supports JSON-LD
 * and Next's string transport containing a complete JSON-LD Event object.
 */
export function extractStructuredEvents(html: string): Record<string, unknown>[] {
  const objects: unknown[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    try {
      if (/type=["']application\/ld\+json["']/i.test(match[1])) {
        objects.push(JSON.parse(match[2]));
      } else {
        const transport = /^\s*self\.__next_f\.push\((\[[\s\S]*\])\);?\s*$/.exec(match[2]);
        if (!transport) continue;
        const tuple: unknown = JSON.parse(transport[1]);
        if (
          Array.isArray(tuple) &&
          tuple[0] === 1 &&
          typeof tuple[1] === 'string' &&
          tuple[1].trim().startsWith('{')
        )
          objects.push(JSON.parse(tuple[1]));
      }
    } catch {
      /* One malformed script does not erase the rest of the page. */
    }
  }
  const flattened = objects.flatMap((o) =>
    Array.isArray(o)
      ? o
      : Array.isArray(record(o)?.['@graph'])
        ? (record(o)!['@graph'] as unknown[])
        : [o]
  );
  return flattened.filter((o): o is Record<string, unknown> =>
    Boolean(record(o) && (o as Record<string, unknown>)['@type'] === 'Event')
  );
}

/** Posh's page publishes offset-aware schema.org times. Its internal `start`
 * field can be a wall clock mislabeled Z; never use that field as an instant.
 */
export function normalizePoshStructuredEvent(
  value: unknown,
  sourceId?: string
): RawCandidate | null {
  const event = record(value);
  if (!event) return null;
  const url = sourceUrl(event.url, 'https://posh.vip/e/', ['posh.vip']);
  const title = text(event.name);
  if (!url || !title) return null;
  const venue = record(event.location),
    address = record(venue?.address),
    geo = record(venue?.geo);
  const offers = Array.isArray(event.offers)
    ? event.offers.map(record).filter((v) => v !== undefined)
    : record(event.offers)
      ? [record(event.offers)!]
      : [];
  const prices = offers
    .map((o) => number(o.price))
    .filter((p): p is number => p !== undefined && p >= 0);
  const currencies = [
    ...new Set(
      offers
        .map((o) => text(o.priceCurrency))
        .filter((c): c is string => Boolean(c && /^[A-Z]{3}$/.test(c)))
    ),
  ];
  const availability = offers.map((o) => text(o.availability)?.split('/').at(-1));
  const details = eventDetails({
    title,
    description: text(event.description),
    startsAt: event.startDate,
    endsAt: event.endDate,
    status: (
      {
        EventCancelled: 'cancelled',
        EventPostponed: 'postponed',
        EventScheduled: 'scheduled',
      } as Record<string, string>
    )[text(event.eventStatus)?.split('/').at(-1) ?? ''],
    soldOut: offers.length > 0 && availability.every((a) => a === 'SoldOut' || a === 'OutOfStock'),
    available: availability.includes('InStock'),
    locationVisibility: venue?.name || address?.streetAddress ? 'public' : 'unknown',
    currency: currencies.length === 1 ? currencies[0] : undefined,
  });
  if (currencies.length > 1)
    details.issues.push('Ticket offers use different currencies; prices omitted.');
  const parsed = RawCandidateSchema.safeParse({
    source: 'posh',
    sourceId: sourceId ?? new URL(url).pathname.split('/').at(-1),
    sourceUrl: url,
    title,
    description: text(event.description),
    startsAt: sourceTime(event.startDate),
    endsAt: sourceEnd(event.startDate, event.endDate),
    venueName: text(venue?.name),
    address: text(address?.streetAddress) ?? text(venue?.address),
    lat: number(geo?.latitude),
    lng: number(geo?.longitude),
    priceMin: currencies.length <= 1 && prices.length ? Math.min(...prices) : undefined,
    priceMax: currencies.length <= 1 && prices.length ? Math.max(...prices) : undefined,
    // A zero-price offer can be a limited RSVP tier; never equate it to unconditional free admission.
    details,
    raw: value,
  });
  return parsed.success ? parsed.data : null;
}
