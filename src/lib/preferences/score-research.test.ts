import { describe, it, expect } from 'vitest';
import { diversifyByCuisine } from './score-research';
import type { RestaurantData } from '@/lib/ai/agents/types';

const r = (name: string, cuisine: string[]): RestaurantData => ({
  name,
  cuisine,
  priceRange: '$$',
});

describe('diversifyByCuisine', () => {
  it('stops one cuisine from owning the pool', () => {
    // The real failure: a "japanese, italian" quiz answer produced a Lisbon
    // trip where four of five meals were Japanese.
    const ranked = [
      r('Ramen 1', ['japanese']),
      r('Ramen 2', ['japanese']),
      r('Ramen 3', ['japanese']),
      r('Ramen 4', ['japanese']),
      r('Tasca 1', ['portuguese']),
      r('Tasca 2', ['portuguese']),
    ];

    const kept = diversifyByCuisine(ranked, 4);
    const japanese = kept.filter((k) => k.cuisine[0] === 'japanese');

    expect(kept).toHaveLength(4);
    expect(japanese).toHaveLength(2); // cap = ceil(4 * 0.5)
    expect(kept.map((k) => k.name)).toContain('Tasca 1');
  });

  it('preserves rank order among what it keeps', () => {
    const ranked = [
      r('Best', ['japanese']),
      r('Second', ['japanese']),
      r('Third', ['japanese']),
      r('Local', ['portuguese']),
    ];
    const kept = diversifyByCuisine(ranked, 3);
    expect(kept.map((k) => k.name)).toEqual(['Best', 'Second', 'Local']);
  });

  it('fills from the overflow rather than returning a short pool', () => {
    // If the destination genuinely only offers one cuisine, a full pool of it
    // beats a half-empty one.
    const ranked = [
      r('A', ['japanese']),
      r('B', ['japanese']),
      r('C', ['japanese']),
      r('D', ['japanese']),
    ];
    const kept = diversifyByCuisine(ranked, 4);
    expect(kept).toHaveLength(4);
  });

  it('treats missing cuisine tags as one bucket without crashing', () => {
    const ranked = [r('A', []), r('B', []), r('C', ['portuguese'])];
    const kept = diversifyByCuisine(ranked, 3);
    expect(kept).toHaveLength(3);
  });

  it('never exceeds the limit', () => {
    const ranked = Array.from({ length: 20 }, (_, i) => r(`R${i}`, ['thai']));
    expect(diversifyByCuisine(ranked, 6)).toHaveLength(6);
  });
});
