import { describe, it, expect } from 'vitest';
import { diversifyByCuisine, intentMatchScore, scoreAttraction } from './score-research';
import type { RestaurantData, AttractionData } from '@/lib/ai/agents/types';
import type { UserPreferences } from '@/types/quiz';

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

/**
 * The "house music" failure: a real NYC generation surfaced "Louis Armstrong
 * House Museum" and "The Merchant House Museum" as top matches, because loose
 * token counting scored "house" as a full keyword hit in both. Word boundaries
 * do not help — it is a whole word there. Phrases are what separate them.
 */
describe('intentMatchScore — phrase-first matching', () => {
  const houseMusic = ['house', 'music'];

  it('scores an intact phrase far above a coincidental token', () => {
    const onTheme = intentMatchScore('Nowadays deep house music club', houseMusic);
    const coincidence = intentMatchScore('Louis Armstrong House Museum', houseMusic);
    expect(onTheme).toBeGreaterThan(coincidence * 4);
  });

  it('barely rewards a museum that merely contains the word "house"', () => {
    expect(intentMatchScore('Louis Armstrong House Museum', houseMusic)).toBeLessThan(1);
    expect(intentMatchScore('The Merchant House Museum', houseMusic)).toBeLessThan(1);
  });

  it('still matches a single-token intent as a substring', () => {
    // "bar" should match "speakeasy bar"; "r&b" should match "r&b lounge".
    expect(intentMatchScore('Attaboy speakeasy bar', ['bar'])).toBeGreaterThan(0);
    expect(intentMatchScore('Ginny’s r&b lounge', ['r&b'])).toBeGreaterThan(0);
  });

  it('rewards an adjacent pair inside a longer intent', () => {
    const kw = ['deep', 'house', 'music', 'clubs'];
    expect(intentMatchScore('a deep house listening room', kw)).toBeGreaterThan(0.5);
  });

  it('is zero without keywords', () => {
    expect(intentMatchScore('anything at all', [])).toBe(0);
  });
});

/**
 * Theme fit is judged by the model at extraction, with the source page in
 * front of it. Curation ranks on that judgement rather than on word overlap,
 * because word overlap cannot tell House of Yes from the Louis Armstrong
 * House Museum.
 */
describe('scoring on the model theme judgement', () => {
  const prefs = {
    activityTypes: [],
    travelMotivations: [],
    cuisinePreferences: [],
  } as unknown as UserPreferences;

  const attraction = (name: string, themeFit?: 'direct' | 'adjacent' | 'none') =>
    ({
      name,
      description: '',
      category: 'x',
      estimatedDuration: 90,
      priceRange: '$$',
      themeFit,
    }) as AttractionData;

  it('ranks a direct match above an adjacent one above an unrelated one', () => {
    const direct = scoreAttraction(attraction('A', 'direct'), prefs);
    const adjacent = scoreAttraction(attraction('B', 'adjacent'), prefs);
    const none = scoreAttraction(attraction('C', 'none'), prefs);
    expect(direct).toBeGreaterThan(adjacent);
    expect(adjacent).toBeGreaterThan(none);
  });

  it('outweighs a coincidental keyword match', () => {
    // "Louis Armstrong House Museum" shares a word with "house music" and is
    // judged unrelated; a real club shares no words and is judged direct.
    const kw = ['house', 'music'];
    const museum = scoreAttraction(attraction('Louis Armstrong House Museum', 'none'), prefs, kw);
    const club = scoreAttraction(attraction('Nowadays', 'direct'), prefs, kw);
    expect(club).toBeGreaterThan(museum);
  });

  it('leaves an untagged pool ranking on its other signals', () => {
    const untagged = scoreAttraction(attraction('A'), prefs);
    const explicitNone = scoreAttraction(attraction('A', 'none'), prefs);
    expect(untagged).toBe(explicitNone);
  });
});
