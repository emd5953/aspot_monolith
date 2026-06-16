import { describe, it, expect } from 'vitest';
import { haversineKm, dayHopDistanceKm, isDaySpreadOut } from './geo';

// Reference points
const NYC = { lat: 40.7128, lng: -74.006 };
const LA = { lat: 34.0522, lng: -118.2437 };
const TIMES_SQ = { lat: 40.758, lng: -73.9855 };

describe('haversineKm', () => {
  it('matches a known long-distance value (NYC↔LA ≈ 3936 km)', () => {
    expect(haversineKm(NYC, LA)).toBeCloseTo(3936, -2); // within ~100 km
  });

  it('is ~0 for identical points', () => {
    expect(haversineKm(NYC, NYC)).toBeCloseTo(0, 5);
  });

  it('gives a small distance for nearby points (NYC↔Times Sq < 6 km)', () => {
    expect(haversineKm(NYC, TIMES_SQ)).toBeLessThan(6);
  });
});

describe('dayHopDistanceKm', () => {
  it('sums consecutive hops and skips points without coordinates', () => {
    const d = dayHopDistanceKm([
      { coordinates: NYC },
      { coordinates: null },
      { coordinates: TIMES_SQ },
      { coordinates: NYC },
    ]);
    // NYC→TimesSq→NYC ≈ 2 * (<6) — small but non-zero
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(12);
  });
});

describe('isDaySpreadOut', () => {
  it('flags a day that hops across a huge distance', () => {
    expect(isDaySpreadOut([{ coordinates: NYC }, { coordinates: LA }])).toBe(true);
  });

  it('does not flag a tight cluster', () => {
    expect(isDaySpreadOut([{ coordinates: NYC }, { coordinates: TIMES_SQ }])).toBe(false);
  });

  it('returns false without at least two located stops', () => {
    expect(isDaySpreadOut([{ coordinates: NYC }])).toBe(false);
    expect(isDaySpreadOut([{ coordinates: NYC }, { coordinates: null }])).toBe(false);
    expect(isDaySpreadOut([])).toBe(false);
  });

  it('respects a custom threshold', () => {
    // NYC↔Times Sq is a few km; a 1 km threshold should flag it.
    expect(isDaySpreadOut([{ coordinates: NYC }, { coordinates: TIMES_SQ }], 1)).toBe(true);
  });
});
