/**
 * NYC wall-clock helpers.
 *
 * Spotz is NYC-only, but the servers are not: Vercel runs UTC. Anything that
 * reasons about "tonight" must therefore be anchored to America/New_York
 * explicitly — `Date.prototype.setHours` uses the *server's* zone, which
 * silently shifts the night window by 4-5 hours in production.
 *
 * DST is handled by measuring the zone's real offset at the instant in
 * question rather than assuming a fixed -05:00/-04:00.
 */

const NYC = 'America/New_York';

/** Milliseconds NYC is ahead of UTC at `at` (negative: NYC is behind). */
function nycOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NYC,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  // hour comes back as 24 at midnight under hour12:false in some ICU versions.
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - at.getTime();
}

/** The calendar date (YYYY-MM-DD) it currently is in NYC at instant `at`. */
export function nycDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * The UTC instant of a NYC wall-clock time on `dateIso` (YYYY-MM-DD).
 *
 * `hour` may exceed 23 to mean "into the following day", which is how the
 * night window is expressed: hour 30 is 6am the next morning. Solved by
 * iteration so a window that starts before a DST switch and ends after it
 * still lands on the correct instant.
 */
export function nycTimeToUtc(dateIso: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  let utc = new Date(wallClock);
  for (let i = 0; i < 2; i++) {
    utc = new Date(wallClock - nycOffsetMs(utc));
  }
  return utc;
}

/**
 * The calendar date a `Date` was built to represent when it was parsed from a
 * bare `YYYY-MM-DD` string (which JS reads as UTC midnight). Use this instead
 * of `nycDate` on such values — in NYC, UTC midnight is still the day before.
 */
export function calendarDateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The night window for a NYC calendar date: local midnight through 6am the
 * following morning. `endDateIso` defaults to `startDateIso` (a one-night out).
 */
export function nycNightWindow(startDateIso: string, endDateIso = startDateIso): {
  from: Date;
  to: Date;
} {
  return {
    from: nycTimeToUtc(startDateIso, 0),
    to: nycTimeToUtc(endDateIso, 30),
  };
}
