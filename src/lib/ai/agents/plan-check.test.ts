import { describe, it, expect } from 'vitest';
import { checkPlan } from './plan-check';
import type { ItineraryPlan, PlanItem, ResearchResult } from './types';

/**
 * These two checks are what survives of `plan-audit` after scheduling was
 * removed. They are the load-bearing ones: a model grading its own output does
 * not reliably notice that it booked a venue twice, or that it named a place
 * from memory instead of from the researched pool.
 */

const research = (names: string[]): ResearchResult => ({
  destination: 'New York City',
  attractions: names.map((name) => ({
    name,
    description: '',
    category: 'x',
    estimatedDuration: 90,
    priceRange: '$$',
  })),
  restaurants: [],
  activities: [],
  localInsights: [],
  sources: [],
});

const plan = (names: string[]): ItineraryPlan => ({
  destination: 'New York City',
  summary: 'a night',
  plans: names.map((name): PlanItem => ({ name, type: 'activity' })),
  totalEstimatedCost: 'Varies',
});

describe('checkPlan — the same venue twice', () => {
  it('is clean when every pick is distinct', () => {
    const out = checkPlan(plan(['A', 'B', 'C']), research(['A', 'B', 'C']));
    expect(out.findings).toHaveLength(0);
    expect(out.scoreCeiling).toBe(100);
    expect(out.stats.duplicateItems).toBe(0);
  });

  it('catches a repeat within the one flat list', () => {
    // The old day-based check only fired across two different days, so on a
    // single list it would never have fired at all.
    const out = checkPlan(plan(['A', 'B', 'A']), research(['A', 'B']));
    expect(out.stats.duplicateItems).toBe(1);
    expect(out.findings[0].severity).toBe('high');
    expect(out.scoreCeiling).toBeLessThanOrEqual(70);
  });

  it('normalizes names before comparing', () => {
    const out = checkPlan(
      plan(['The Bluebird Cafe', 'Bluebird Cafe']),
      research(['The Bluebird Cafe'])
    );
    expect(out.stats.duplicateItems).toBe(1);
  });
});

describe('checkPlan — invented places', () => {
  it('is quiet when the picks came from the pool', () => {
    const out = checkPlan(plan(['A', 'B', 'C']), research(['A', 'B', 'C']));
    expect(out.stats.offPoolItems).toBe(0);
  });

  it('flags a plan mostly made of places research never found', () => {
    const out = checkPlan(
      plan(['Ghost Bar', 'Fake Club', 'Imaginary Lounge', 'A']),
      research(['A'])
    );
    expect(out.stats.offPoolItems).toBe(3);
    expect(out.findings.some((f) => f.issue.includes('not from the research pool'))).toBe(true);
    expect(out.scoreCeiling).toBeLessThanOrEqual(80);
  });

  it('tolerates a minority of off-pool picks', () => {
    // One stray in four is under the warn ratio — worth counting, not worth
    // failing, since the planner may legitimately name a well-known spot.
    const out = checkPlan(plan(['A', 'B', 'C', 'Stray']), research(['A', 'B', 'C']));
    expect(out.stats.offPoolItems).toBe(1);
    expect(out.findings).toHaveLength(0);
  });

  it('accuses nothing when research produced an empty pool', () => {
    // Empty pool means research failed, not that every pick is invented.
    const out = checkPlan(plan(['A', 'B']), research([]));
    expect(out.stats.offPoolItems).toBe(0);
    expect(out.findings).toHaveLength(0);
  });
});

describe('checkPlan — stats', () => {
  it('counts how many picks carry a real published time', () => {
    const withTimes: ItineraryPlan = {
      destination: 'New York City',
      summary: 'a night',
      totalEstimatedCost: 'Varies',
      plans: [
        { name: 'A', type: 'activity', startsAt: '2026-09-12T22:00:00-04:00' },
        { name: 'B', type: 'restaurant' },
      ],
    };
    const out = checkPlan(withTimes, research(['A', 'B']));
    expect(out.stats.timedItems).toBe(1);
    expect(out.stats.totalItems).toBe(2);
  });

  it('takes the lowest ceiling when several findings stand', () => {
    const out = checkPlan(
      plan(['Ghost', 'Ghost', 'Phantom', 'Spectre']),
      research(['Something Else'])
    );
    // duplicate (70) and off-pool (80) both fire; the min wins.
    expect(out.scoreCeiling).toBe(70);
  });
});
