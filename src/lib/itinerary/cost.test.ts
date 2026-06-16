import { describe, it, expect } from 'vitest';
import {
  sumDayCost,
  rollUpCost,
  formatUsd,
  tripBudgetCeiling,
  classifyBudget,
} from './cost';

describe('sumDayCost', () => {
  it('sums numeric and DECIMAL-string costs, ignoring junk', () => {
    expect(
      sumDayCost([
        { estimatedCost: 40 },
        { estimatedCost: '25.50' }, // PostgREST decimal string
        { estimatedCost: null },
        { estimatedCost: undefined },
        { estimatedCost: 0 },
        { estimatedCost: -5 }, // ignored
      ])
    ).toBe(65.5);
  });
});

describe('rollUpCost', () => {
  it('produces per-day subtotals + total and flags hasData', () => {
    const r = rollUpCost([
      { activities: [{ estimatedCost: 100 }, { estimatedCost: 50 }] },
      { activities: [{ estimatedCost: '20' }] },
    ]);
    expect(r.perDay).toEqual([150, 20]);
    expect(r.total).toBe(170);
    expect(r.hasData).toBe(true);
  });

  it('reports hasData=false when nothing has a usable cost', () => {
    const r = rollUpCost([{ activities: [{ estimatedCost: null }, {}] }]);
    expect(r.total).toBe(0);
    expect(r.hasData).toBe(false);
  });
});

describe('formatUsd', () => {
  it('renders whole dollars with thousands separators', () => {
    expect(formatUsd(1250.4)).toBe('$1,250');
    expect(formatUsd(0)).toBe('$0');
  });
});

describe('tripBudgetCeiling', () => {
  it('scales the per-tier per-day ceiling by trip length', () => {
    expect(tripBudgetCeiling('budget', 3)).toBe(360); // 120 * 3
    expect(tripBudgetCeiling('luxury', 2)).toBe(1600); // 800 * 2
  });

  it('falls back to the moderate tier for unknown/blank values', () => {
    expect(tripBudgetCeiling(undefined, 1)).toBe(300);
    expect(tripBudgetCeiling('???', 1)).toBe(300);
  });
});

describe('classifyBudget', () => {
  it('flags over budget when the total exceeds the ceiling', () => {
    // moderate, 2 days → ceiling 600
    expect(classifyBudget(700, 'moderate', 2).status).toBe('over');
  });

  it('flags well under budget below half the ceiling', () => {
    expect(classifyBudget(200, 'moderate', 2).status).toBe('under'); // < 300
  });

  it('flags within budget in the middle band', () => {
    expect(classifyBudget(450, 'moderate', 2).status).toBe('within');
  });
});
