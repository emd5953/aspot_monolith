import { describe, it, expect } from 'vitest';
import {
  shouldSearchEvents,
  buildEventsQuery,
  formatDateWindow,
  daysUntil,
  EVENTS_HORIZON_DAYS,
} from './events-search';

const NOW = new Date('2026-06-16T12:00:00Z');
const d = (iso: string) => new Date(iso);

describe('shouldSearchEvents', () => {
  it('runs for an upcoming trip inside the horizon', () => {
    expect(shouldSearchEvents(d('2026-06-20'), d('2026-06-23'), NOW)).toBe(true);
  });

  it('runs for a trip already in progress (start past, end future)', () => {
    expect(shouldSearchEvents(d('2026-06-14'), d('2026-06-18'), NOW)).toBe(true);
  });

  it('skips a trip entirely in the past', () => {
    expect(shouldSearchEvents(d('2026-05-01'), d('2026-05-05'), NOW)).toBe(false);
  });

  it('skips a trip beyond the horizon', () => {
    const farStart = new Date(NOW.getTime() + (EVENTS_HORIZON_DAYS + 10) * 86400000);
    const farEnd = new Date(farStart.getTime() + 3 * 86400000);
    expect(shouldSearchEvents(farStart, farEnd, NOW)).toBe(false);
  });

  it('runs right at the horizon edge', () => {
    const edge = new Date(NOW.getTime() + EVENTS_HORIZON_DAYS * 86400000);
    expect(shouldSearchEvents(edge, new Date(edge.getTime() + 86400000), NOW)).toBe(true);
  });

  it('does not search on unparseable dates', () => {
    expect(shouldSearchEvents(d('not-a-date'), d('2026-06-23'), NOW)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('is positive for future, negative for past', () => {
    expect(daysUntil(d('2026-06-26T12:00:00Z'), NOW)).toBe(10);
    expect(daysUntil(d('2026-06-06T12:00:00Z'), NOW)).toBe(-10);
  });
});

describe('formatDateWindow', () => {
  it('uses a single month when start and end share one', () => {
    expect(formatDateWindow(d('2026-06-02'), d('2026-06-09'))).toBe('in June 2026');
  });

  it('spans two months when the trip straddles them', () => {
    expect(formatDateWindow(d('2026-06-28'), d('2026-07-03'))).toBe(
      'between June 2026 and July 2026'
    );
  });
});

describe('buildEventsQuery', () => {
  it('pins the destination and date window', () => {
    const q = buildEventsQuery('Lisbon', d('2026-06-20'), d('2026-06-23'));
    expect(q).toContain('Lisbon');
    expect(q).toContain('in June 2026');
    expect(q).toMatch(/events.*happening/i);
  });

  it('leads with the user focus and collapses whitespace', () => {
    const q = buildEventsQuery('Austin', d('2026-06-20'), d('2026-06-23'), 'R&B and live music');
    expect(q.startsWith('R&B and live music')).toBe(true);
    expect(q).not.toMatch(/\s{2,}/);
  });
});
