import { describe, it, expect } from 'vitest';
import { dedupeRows, normalizeDedupeKey } from './pool-service';
import { isInNyc } from './types';

describe('normalizeDedupeKey', () => {
  it('keys on date + normalized title', () => {
    expect(normalizeDedupeKey('House of Yes: DIRTY Circus!', '2026-09-05T22:00:00-04:00')).toBe(
      '2026-09-05::house of yes dirty circus'
    );
  });

  it('treats undated events as their own bucket', () => {
    expect(normalizeDedupeKey('Rooftop thing')).toBe('undated::rooftop thing');
  });

  it('collapses punctuation and whitespace differences', () => {
    const a = normalizeDedupeKey('BUSHWICK  RAVE!!!', '2026-09-05T23:00:00-04:00');
    const b = normalizeDedupeKey('bushwick rave', '2026-09-05T21:00:00-04:00');
    expect(a).toBe(b);
  });
});

describe('dedupeRows', () => {
  const mk = (source: string, title: string, starts_at: string | null) => ({
    source,
    title,
    starts_at,
  });

  it('keeps the higher-priority source for cross-listed events', () => {
    const rows = [
      mk('luma', 'Warehouse Party', '2026-09-05T22:00:00-04:00'),
      mk('partiful', 'Warehouse Party!', '2026-09-05T23:00:00-04:00'),
      mk('posh', 'warehouse party', '2026-09-05T21:00:00-04:00'),
    ];
    const out = dedupeRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('partiful');
  });

  it('does not merge same title on different nights', () => {
    const rows = [
      mk('posh', 'Warehouse Party', '2026-09-05T22:00:00-04:00'),
      mk('posh', 'Warehouse Party', '2026-09-06T22:00:00-04:00'),
    ];
    expect(dedupeRows(rows)).toHaveLength(2);
  });
});

describe('isInNyc', () => {
  it('accepts the five boroughs', () => {
    expect(isInNyc(40.7128, -74.006)).toBe(true); // Manhattan
    expect(isInNyc(40.6782, -73.9442)).toBe(true); // Brooklyn
  });

  it('rejects far-away coordinates', () => {
    expect(isInNyc(34.0522, -118.2437)).toBe(false); // LA
    expect(isInNyc(39.9526, -75.1652)).toBe(false); // Philly
  });

  it('keeps unlocated candidates (events rule: enrich, never filter)', () => {
    expect(isInNyc(undefined, undefined)).toBe(true);
  });
});
