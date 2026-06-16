/**
 * Date-aware events search.
 *
 * Most of the research pool is timeless ("best ramen in Tokyo"). But a trip
 * pinned to specific dates can also be served by things *happening then* —
 * a festival, a concert, a one-off exhibition. Those are only worth searching
 * for when the trip is actually upcoming and close enough that venues have
 * published their calendars; chasing events for a trip 14 months out (or one
 * already in the past) just burns a paid search for nothing.
 *
 * These are pure helpers — the gating decision and the query string — so the
 * (paid) Tavily call in tavily-service can stay a thin wrapper and the
 * interesting logic is cheap to unit-test.
 */

/**
 * How far ahead we bother looking for events. Beyond this most venues haven't
 * announced schedules yet, so an events search returns generic noise.
 */
export const EVENTS_HORIZON_DAYS = 180;

/** Whole days from `now` until `date` (negative if already past). */
export function daysUntil(date: Date, now: Date): number {
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Should we run the events pass for this trip?
 *
 * Yes when the trip isn't already over (its last day is today or later) and it
 * starts within the horizon. A trip already in progress still qualifies — there
 * may be events during the remaining days.
 */
export function shouldSearchEvents(
  startDate: Date,
  endDate: Date,
  now: Date = new Date()
): boolean {
  // Guard against bad/unparseable dates rather than searching on garbage.
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false;
  }
  // Entirely in the past → nothing live to add.
  if (endDate.getTime() < now.getTime()) return false;
  // Too far out → schedules aren't published; skip the spend.
  if (daysUntil(startDate, now) > EVENTS_HORIZON_DAYS) return false;
  return true;
}

/** "June 2026" in a timezone-stable way (UTC) for deterministic queries. */
function monthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A human date window for the query: "in June 2026" for a single month, or
 * "between June 2026 and July 2026" when the trip straddles two.
 */
export function formatDateWindow(startDate: Date, endDate: Date): string {
  const start = monthYear(startDate);
  const end = monthYear(endDate);
  return start === end ? `in ${start}` : `between ${start} and ${end}`;
}

/**
 * Build the date-aware events query. Leads with the user's focus (when present)
 * so an "R&B nightlife" trip surfaces concerts over craft fairs, and pins the
 * date window so we get things happening *then*, not an evergreen listing.
 */
export function buildEventsQuery(
  destination: string,
  startDate: Date,
  endDate: Date,
  userIntent?: string
): string {
  const intent = (userIntent || '').trim();
  const window = formatDateWindow(startDate, endDate);
  return `${intent} events concerts festivals live shows exhibitions happening in ${destination} ${window}`
    .replace(/\s+/g, ' ')
    .trim();
}
