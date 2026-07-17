import { describe, it, expect } from 'vitest';
import {
  roundRobin,
  clusterByProximity,
  partitionResearchAcrossDays,
  refillBucket,
  type DayPool,
} from './pool-partition';
import type {
  AttractionData,
  RestaurantData,
  ActivityData,
  ResearchResult,
} from './types';

const attraction = (
  name: string,
  coords?: { lat: number; lng: number }
): AttractionData => ({
  name,
  description: `${name} description`,
  category: 'landmark',
  estimatedDuration: 90,
  priceRange: '$$',
  coordinates: coords,
});

const restaurant = (
  name: string,
  coords?: { lat: number; lng: number }
): RestaurantData => ({
  name,
  cuisine: ['italian'],
  priceRange: '$$',
  coordinates: coords,
});

const activity = (name: string): ActivityData => ({
  name,
  description: `${name} description`,
  category: 'tour',
  duration: 120,
  adventureLevel: 5,
  priceRange: '$$',
});

const research = (
  attractions: AttractionData[],
  restaurants: RestaurantData[] = [],
  activities: ActivityData[] = []
): ResearchResult => ({
  destination: 'Testville',
  attractions,
  restaurants,
  activities,
  localInsights: [],
  sources: [],
});

describe('roundRobin', () => {
  it('interleaves by rank so each day gets a comparable quality spread', () => {
    const split = roundRobin(['a', 'b', 'c', 'd', 'e'], 2);
    expect(split[0]).toEqual(['a', 'c', 'e']);
    expect(split[1]).toEqual(['b', 'd']);
  });

  it('returns empty arrays for days beyond the item count', () => {
    const split = roundRobin(['a'], 3);
    expect(split).toEqual([['a'], [], []]);
  });
});

describe('clusterByProximity', () => {
  // Two tight geographic groups ~10km apart.
  const groupA = [
    attraction('A1', { lat: 40.7, lng: -74.0 }),
    attraction('A2', { lat: 40.705, lng: -74.005 }),
    attraction('A3', { lat: 40.71, lng: -74.01 }),
  ];
  const groupB = [
    attraction('B1', { lat: 40.8, lng: -73.9 }),
    attraction('B2', { lat: 40.805, lng: -73.905 }),
    attraction('B3', { lat: 40.81, lng: -73.91 }),
  ];

  it('separates distinct geographic groups into different days', () => {
    const clusters = clusterByProximity([...groupA, ...groupB], 2);
    expect(clusters).not.toBeNull();
    const names = clusters!.map((c) => c.map((i) => i.name).sort());
    // Each cluster should be all-A or all-B, never mixed.
    for (const cluster of names) {
      const prefixes = new Set(cluster.map((n) => n[0]));
      expect(prefixes.size).toBe(1);
    }
  });

  it('returns null when too few items carry coordinates', () => {
    const mostlyUnlocated = [
      attraction('A1', { lat: 40.7, lng: -74.0 }),
      attraction('X1'),
      attraction('X2'),
      attraction('X3'),
      attraction('X4'),
      attraction('X5'),
    ];
    expect(clusterByProximity(mostlyUnlocated, 2)).toBeNull();
  });

  it('returns null for single-day trips', () => {
    expect(clusterByProximity(groupA, 1)).toBeNull();
  });

  it('caps cluster size so one dense area cannot starve other days', () => {
    // 5 items in one spot, 1 far away: cap for 2 days is ceil(6/2)=3.
    const dense = Array.from({ length: 5 }, (_, i) =>
      attraction(`D${i}`, { lat: 40.7 + i * 0.0001, lng: -74.0 })
    );
    const lone = attraction('L', { lat: 41.5, lng: -73.0 });
    const clusters = clusterByProximity([...dense, lone], 2)!;
    expect(Math.max(...clusters.map((c) => c.length))).toBeLessThanOrEqual(3);
  });

  it('places unlocated items into the smallest cluster', () => {
    const clusters = clusterByProximity(
      [...groupA, ...groupB, attraction('NoCoords')],
      2
    );
    expect(clusters).not.toBeNull();
    const total = clusters!.flat().length;
    expect(total).toBe(7);
  });
});

describe('partitionResearchAcrossDays', () => {
  it('returns the whole pool for a 1-day trip', () => {
    const r = research([attraction('A')], [restaurant('R')], [activity('X')]);
    const { pools, geoClustered } = partitionResearchAcrossDays(r, 1);
    expect(pools).toHaveLength(1);
    expect(pools[0].attractions).toHaveLength(1);
    expect(geoClustered).toBe(false);
  });

  it('produces disjoint pools across days', () => {
    const r = research(
      Array.from({ length: 8 }, (_, i) => attraction(`A${i}`)),
      Array.from({ length: 6 }, (_, i) => restaurant(`R${i}`)),
      Array.from({ length: 4 }, (_, i) => activity(`X${i}`))
    );
    const { pools } = partitionResearchAcrossDays(r, 3);
    expect(pools).toHaveLength(3);
    const allNames = pools.flatMap((p) => [
      ...p.attractions.map((a) => a.name),
      ...p.restaurants.map((x) => x.name),
      ...p.activities.map((x) => x.name),
    ]);
    expect(new Set(allNames).size).toBe(allNames.length);
    expect(allNames).toHaveLength(18);
  });

  it('assigns located restaurants to the nearest attraction cluster', () => {
    const r = research(
      [
        attraction('A1', { lat: 40.7, lng: -74.0 }),
        attraction('A2', { lat: 40.705, lng: -74.005 }),
        attraction('B1', { lat: 40.8, lng: -73.9 }),
        attraction('B2', { lat: 40.805, lng: -73.905 }),
      ],
      [
        restaurant('NearA', { lat: 40.702, lng: -74.002 }),
        restaurant('NearB', { lat: 40.802, lng: -73.902 }),
      ]
    );
    const { pools, geoClustered } = partitionResearchAcrossDays(r, 2);
    expect(geoClustered).toBe(true);
    for (const pool of pools) {
      const attractionPrefix = pool.attractions[0].name[0];
      for (const rest of pool.restaurants) {
        expect(rest.name).toBe(`Near${attractionPrefix}`);
      }
    }
  });
});

describe('refillBucket', () => {
  const pool: DayPool = {
    attractions: [attraction('Museum')],
    restaurants: [restaurant('Trattoria')],
    activities: [activity('Bike Tour')],
  };

  it('prefers a restaurant for the evening bucket', () => {
    const item = refillBucket('evening', pool, new Set());
    expect(item?.name).toBe('Trattoria');
    expect(item?.type).toBe('restaurant');
    expect(item?.time).toBe('19:00');
  });

  it('prefers an attraction for the morning bucket', () => {
    const item = refillBucket('morning', pool, new Set());
    expect(item?.name).toBe('Museum');
    expect(item?.type).toBe('attraction');
  });

  it('skips items already used and falls through types', () => {
    const used = new Set(['trattoria']);
    const item = refillBucket('evening', pool, used);
    expect(item?.name).toBe('Bike Tour');
    expect(item?.type).toBe('activity');
  });

  it('marks the picked item as used', () => {
    const used = new Set<string>();
    refillBucket('morning', pool, used);
    expect(used.has('museum')).toBe(true);
  });

  it('returns null when the pool is exhausted', () => {
    const used = new Set(['museum', 'trattoria', 'bike tour']);
    expect(refillBucket('afternoon', pool, used)).toBeNull();
  });
});
