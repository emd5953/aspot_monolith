import { describe, it, expect } from 'vitest';
import { poolRowToActivity, poolRowsToActivities } from './pool-events';
import type { PoolCandidateRow } from '@/lib/sources/pool-service';

/**
 * The pool→ActivityData conversion is where a real event's published start
 * time enters the pipeline. It used to be flattened into an English fragment
 * inside the description ("Starts 9:30 PM") and dropped as structured data,
 * which left the planner inventing a clock time for an event whose time was
 * already known. These tests pin that `startsAt` survives as data.
 */

const row = (over: Partial<PoolCandidateRow> = {}): PoolCandidateRow => ({
  id: 'id-1',
  source: 'posh',
  source_id: 'p1',
  source_url: 'https://posh.vip/e/p1',
  title: 'Warehouse Set',
  description: 'All night house',
  starts_at: '2026-09-12T23:00:00-04:00',
  ends_at: '2026-09-13T04:00:00-04:00',
  venue_name: 'Bushwick Warehouse',
  address: '123 Somewhere Ave, Brooklyn',
  lat: 40.7,
  lng: -73.93,
  price_min: 20,
  price_max: 30,
  is_free: false,
  hype: {},
  tags: [],
  fetched_at: '2026-09-09T00:00:00Z',
  expires_at: null,
  ...over,
});

describe('poolRowToActivity — real published times', () => {
  it('carries starts_at and ends_at through as structured data', () => {
    const a = poolRowToActivity(row());
    expect(a.startsAt).toBe('2026-09-12T23:00:00-04:00');
    expect(a.endsAt).toBe('2026-09-13T04:00:00-04:00');
  });

  it('leaves the times absent when the source published none', () => {
    const a = poolRowToActivity(row({ starts_at: null, ends_at: null }));
    // Absent means UNKNOWN. Never coerce to a default time — that is the
    // invented-clock-time bug this whole field exists to kill.
    expect(a.startsAt).toBeUndefined();
    expect(a.endsAt).toBeUndefined();
  });

  it('keeps a start time even when the end is unknown', () => {
    const a = poolRowToActivity(row({ ends_at: null }));
    expect(a.startsAt).toBe('2026-09-12T23:00:00-04:00');
    expect(a.endsAt).toBeUndefined();
  });

  it('still renders the human-readable time in the description', () => {
    // Prose stays: it is useful context in an LLM prompt. It is no longer the
    // only place the time exists.
    expect(poolRowToActivity(row()).description).toContain('Starts 11:00 PM');
  });
});

describe('poolRowToActivity — duration from the published window', () => {
  it('derives duration from the real start/end span', () => {
    // 23:00 → 04:00 next day = 5h
    expect(poolRowToActivity(row()).duration).toBe(300);
  });

  it('falls back to 120 when the window is unknown', () => {
    expect(poolRowToActivity(row({ ends_at: null })).duration).toBe(120);
    expect(poolRowToActivity(row({ starts_at: null })).duration).toBe(120);
  });

  it('falls back to 120 rather than trusting a non-positive span', () => {
    const backwards = row({
      starts_at: '2026-09-12T23:00:00-04:00',
      ends_at: '2026-09-12T21:00:00-04:00',
    });
    expect(poolRowToActivity(backwards).duration).toBe(120);
  });
});

describe('poolRowToActivity — the rest of the shape', () => {
  it('maps price to a tier, and free to "free"', () => {
    expect(poolRowToActivity(row({ is_free: true })).priceRange).toBe('free');
    expect(poolRowToActivity(row({ price_max: 10 })).priceRange).toBe('$');
    expect(poolRowToActivity(row({ price_max: 40 })).priceRange).toBe('$$');
    expect(poolRowToActivity(row({ price_max: 200 })).priceRange).toBe('$$$');
  });

  it('defaults to $$ when the source priced nothing', () => {
    expect(
      poolRowToActivity(row({ price_min: null, price_max: null })).priceRange
    ).toBe('$$');
  });

  it('carries coordinates when present and omits them when not', () => {
    expect(poolRowToActivity(row()).coordinates).toEqual({ lat: 40.7, lng: -73.93 });
    expect(poolRowToActivity(row({ lat: null, lng: null })).coordinates).toBeUndefined();
  });

  it('falls back to the title when there is nothing else to say', () => {
    const bare = row({ description: null, starts_at: null, venue_name: null });
    expect(poolRowToActivity(bare).description).toBe('Warehouse Set');
  });

  it('converts a batch in order', () => {
    const out = poolRowsToActivities([row({ title: 'A' }), row({ title: 'B' })]);
    expect(out.map((a) => a.name)).toEqual(['A', 'B']);
  });
});
