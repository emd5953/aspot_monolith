import { describe, it, expect } from 'vitest';
import {
  buildItineraryIcs,
  escapeText,
  foldLine,
  formatIcsDate,
  formatIcsDateTime,
  icsFilename,
  type IcsItinerary,
} from './ics';

const NOW = new Date('2026-06-16T12:30:00Z');

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines per RFC 5545', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi');
  });

  it('folds long lines with CRLF + space and keeps content recoverable', () => {
    const long = 'DESCRIPTION:' + 'x'.repeat(200);
    const folded = foldLine(long);
    expect(folded).toContain('\r\n ');
    // Unfolding (strip CRLF+space) restores the original line.
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    // No content line exceeds 75 chars.
    expect(folded.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
});

describe('date/time formatting', () => {
  it('formats a date as UTC YYYYMMDD without timezone drift', () => {
    expect(formatIcsDate('2026-06-20')).toBe('20260620');
    expect(formatIcsDate(new Date('2026-06-20T00:00:00Z'))).toBe('20260620');
  });

  it('combines a date and HH:MM[:SS] into floating local datetime', () => {
    expect(formatIcsDateTime('2026-06-20', '09:30')).toBe('20260620T093000');
    expect(formatIcsDateTime('2026-06-20', '18:05:45')).toBe('20260620T180545');
  });
});

describe('icsFilename', () => {
  it('slugifies the title and appends .ics', () => {
    expect(icsFilename('2 Nights in NYC!')).toBe('2-nights-in-nyc.ics');
    expect(icsFilename('   ')).toBe('itinerary.ics');
  });
});

describe('buildItineraryIcs', () => {
  const itinerary: IcsItinerary = {
    id: 'it1',
    title: 'Tokyo Trip',
    days: [
      {
        date: '2026-06-20',
        activities: [
          {
            id: 'a1',
            title: 'Lunch at Joe; & Co',
            locationName: '1 Main St, Tokyo',
            notes: 'Reddit favorite',
            startTime: '12:00',
            endTime: '13:30',
          },
          { id: 'a2', title: 'Museum (no set time)' }, // → all-day
        ],
      },
    ],
  };

  it('emits a valid VCALENDAR skeleton', () => {
    const ics = buildItineraryIcs(itinerary, NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//aSpot//Itinerary//EN');
    // CRLF line endings throughout.
    expect(ics.includes('\n') && ics.includes('\r\n')).toBe(true);
  });

  it('writes a timed VEVENT for an activity with start+end', () => {
    const ics = buildItineraryIcs(itinerary, NOW);
    expect(ics).toContain('UID:a1@aspot');
    expect(ics).toContain('DTSTART:20260620T120000');
    expect(ics).toContain('DTEND:20260620T133000');
    expect(ics).toContain('DTSTAMP:20260616T123000Z');
    // TEXT escaping applied to summary/location.
    expect(ics).toContain('SUMMARY:Lunch at Joe\\; & Co');
    expect(ics).toContain('LOCATION:1 Main St\\, Tokyo');
    expect(ics).toContain('DESCRIPTION:Reddit favorite');
  });

  it('writes an all-day VEVENT (exclusive next-day DTEND) when an activity has no time', () => {
    const ics = buildItineraryIcs(itinerary, NOW);
    expect(ics).toContain('UID:a2@aspot');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260620');
    expect(ics).toContain('DTEND;VALUE=DATE:20260621');
  });

  it('emits one VEVENT per activity', () => {
    const ics = buildItineraryIcs(itinerary, NOW);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics.match(/END:VEVENT/g)?.length).toBe(2);
  });
});
