/**
 * iCalendar (.ics) builder for an itinerary.
 *
 * Produces an RFC 5545 VCALENDAR with one VEVENT per activity:
 *  - timed event when the activity has both a start and end time,
 *  - all-day event for the day otherwise.
 *
 * Pure (no I/O) so the route stays a thin wrapper and the formatting — text
 * escaping, line folding, all-day vs timed — is unit-testable.
 */

export interface IcsActivity {
  id: string;
  title: string;
  locationName?: string;
  notes?: string;
  /** "HH:MM" or "HH:MM:SS" (the DB TIME column), or absent. */
  startTime?: string;
  endTime?: string;
}

export interface IcsDay {
  /** The calendar day. A Date (interpreted in UTC) or a "YYYY-MM-DD" string. */
  date: Date | string;
  activities: IcsActivity[];
}

export interface IcsItinerary {
  id: string;
  title: string;
  days: IcsDay[];
}

const CRLF = '\r\n';

/** Escape a TEXT value per RFC 5545 §3.3.11 (backslash, semicolon, comma, newlines). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line to <=75 octets with CRLF + space continuations (§3.1). */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(line.slice(i, i + 74));
  }
  return chunks.join(`${CRLF} `);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

/** YYYYMMDD in UTC (the day the date represents, no timezone shifting). */
export function formatIcsDate(date: Date | string): string {
  const d = toDate(date);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** The day after `date` as YYYYMMDD — all-day DTEND is exclusive. */
function formatIcsDatePlusOne(date: Date | string): string {
  const d = toDate(date);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return formatIcsDate(next);
}

/** Combine a UTC date with an "HH:MM[:SS]" time into floating YYYYMMDDTHHMMSS. */
export function formatIcsDateTime(date: Date | string, time: string): string {
  const [h = '0', m = '0', s = '0'] = time.split(':');
  return `${formatIcsDate(date)}T${pad2(Number(h))}${pad2(Number(m))}${pad2(Number(s))}`;
}

/** UTC timestamp with trailing Z, for DTSTAMP. */
function formatIcsStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

function eventLines(
  activity: IcsActivity,
  day: IcsDay,
  stamp: string
): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${activity.id}@aspot`,
    `DTSTAMP:${stamp}`,
  ];

  // Timed only when both ends are present; otherwise an all-day event.
  if (activity.startTime && activity.endTime) {
    lines.push(`DTSTART:${formatIcsDateTime(day.date, activity.startTime)}`);
    lines.push(`DTEND:${formatIcsDateTime(day.date, activity.endTime)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(day.date)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDatePlusOne(day.date)}`);
  }

  lines.push(`SUMMARY:${escapeText(activity.title)}`);
  if (activity.locationName) lines.push(`LOCATION:${escapeText(activity.locationName)}`);
  if (activity.notes) lines.push(`DESCRIPTION:${escapeText(activity.notes)}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * Build the full .ics document for an itinerary. `now` is injectable so DTSTAMP
 * is deterministic in tests.
 */
export function buildItineraryIcs(itinerary: IcsItinerary, now: Date = new Date()): string {
  const stamp = formatIcsStamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//aSpot//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(itinerary.title)}`,
  ];

  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      lines.push(...eventLines(activity, day, stamp));
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** A safe download filename derived from the itinerary title. */
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'itinerary'}.ics`;
}
