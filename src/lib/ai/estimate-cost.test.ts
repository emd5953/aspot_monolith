import { describe, it, expect } from 'vitest';
import { normalizePriceTier, estimateActivityCost } from './estimate-cost';

describe('normalizePriceTier', () => {
  it('counts dollar signs', () => {
    expect(normalizePriceTier('$')).toBe(1);
    expect(normalizePriceTier('$$')).toBe(2);
    expect(normalizePriceTier('$$$')).toBe(3);
    expect(normalizePriceTier('$$$$')).toBe(3); // capped
  });

  it('maps free and word tiers', () => {
    expect(normalizePriceTier('free')).toBe(0);
    expect(normalizePriceTier('budget')).toBe(1);
    expect(normalizePriceTier('moderate')).toBe(2);
    expect(normalizePriceTier('luxury')).toBe(3);
  });

  it('defaults unknown/blank to moderate', () => {
    expect(normalizePriceTier(undefined)).toBe(2);
    expect(normalizePriceTier('')).toBe(2);
    expect(normalizePriceTier('???')).toBe(2);
  });
});

describe('estimateActivityCost', () => {
  it('uses category-appropriate ballparks per tier', () => {
    expect(estimateActivityCost('restaurant', '$$')).toBe(35);
    expect(estimateActivityCost('attraction', '$')).toBe(12);
    expect(estimateActivityCost('activity', '$$$')).toBe(150);
  });

  it('returns 0 for free and zero-cost categories', () => {
    expect(estimateActivityCost('restaurant', 'free')).toBe(0);
    expect(estimateActivityCost('transport', '$$')).toBe(0);
    expect(estimateActivityCost('free_time', '$$$')).toBe(0);
  });

  it('falls back to the attraction row for unknown categories', () => {
    expect(estimateActivityCost('mystery', '$$')).toBe(25);
  });

  it('gives a moderate estimate when the price marker is unknown', () => {
    expect(estimateActivityCost('restaurant', undefined)).toBe(35); // tier 2
  });
});
