import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  dayHopDistanceKm,
  isDaySpreadOut,
  nearestNeighborOrder,
  canTidyDay,
  type OrderablePoint,
} from './geo';

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

// A small set of points laid out on a line so the optimal visiting order is
// obvious. Presented to the orderer in a deliberately zig-zag order.
const A = { lat: 40.70, lng: -74.00 };
const B = { lat: 40.71, lng: -74.00 };
const C = { lat: 40.72, lng: -74.00 };
const D = { lat: 40.73, lng: -74.00 };

function totalPath(ids: string[], byId: Record<string, OrderablePoint>): number {
  return dayHopDistanceKm(ids.map((id) => ({ coordinates: byId[id].coordinates })));
}

describe('nearestNeighborOrder', () => {
  it('produces a shorter total path than a zig-zag input', () => {
    // Input order A → D → B → C zig-zags up and down the line.
    const points: OrderablePoint[] = [
      { id: 'a', coordinates: A },
      { id: 'd', coordinates: D },
      { id: 'b', coordinates: B },
      { id: 'c', coordinates: C },
    ];
    const byId = Object.fromEntries(points.map((p) => [p.id, p]));

    const ordered = nearestNeighborOrder(points);

    expect(ordered).toEqual(['a', 'b', 'c', 'd']);
    expect(totalPath(ordered, byId)).toBeLessThan(totalPath(['a', 'd', 'b', 'c'], byId));
  });

  it('anchors on the first stop, not the global optimum', () => {
    // Starting from D, nearest-neighbor walks back down the line.
    const points: OrderablePoint[] = [
      { id: 'd', coordinates: D },
      { id: 'a', coordinates: A },
      { id: 'c', coordinates: C },
      { id: 'b', coordinates: B },
    ];
    expect(nearestNeighborOrder(points)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('keeps un-located stops in original relative order at the end', () => {
    const points: OrderablePoint[] = [
      { id: 'a', coordinates: A },
      { id: 'x', coordinates: null },
      { id: 'd', coordinates: D },
      { id: 'y' },
      { id: 'b', coordinates: B },
    ];
    expect(nearestNeighborOrder(points)).toEqual(['a', 'b', 'd', 'x', 'y']);
  });

  it('returns input order unchanged with two or fewer located stops', () => {
    const points: OrderablePoint[] = [
      { id: 'a', coordinates: A },
      { id: 'd', coordinates: D },
      { id: 'x', coordinates: null },
    ];
    expect(nearestNeighborOrder(points)).toEqual(['a', 'd', 'x']);
  });
});

describe('canTidyDay', () => {
  it('is true for >=3 located stops that are spread out', () => {
    const spread: OrderablePoint[] = [
      { id: 'a', coordinates: NYC },
      { id: 'b', coordinates: LA },
      { id: 'c', coordinates: TIMES_SQ },
    ];
    expect(canTidyDay(spread)).toBe(true);
  });

  it('is false with fewer than 3 located stops, even if spread out', () => {
    const twoFar: OrderablePoint[] = [
      { id: 'a', coordinates: NYC },
      { id: 'b', coordinates: LA },
      { id: 'c', coordinates: null },
    ];
    expect(canTidyDay(twoFar)).toBe(false);
  });

  it('is false for a tight cluster of 3+ stops', () => {
    const tight: OrderablePoint[] = [
      { id: 'a', coordinates: NYC },
      { id: 'b', coordinates: TIMES_SQ },
      { id: 'c', coordinates: { lat: 40.73, lng: -73.99 } },
    ];
    expect(canTidyDay(tight)).toBe(false);
  });
});
