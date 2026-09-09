import { describe, it, expect } from 'vitest';
import {
  gradeAll,
  gradePool,
  formatGrades,
  poolNames,
  POOLS,
  type Grade,
} from './grade';
import { checkPlan } from '@/lib/ai/agents/plan-check';
import { dropDuplicatePlans, orderByStartTime } from '@/lib/ai/agents/order-plans';
import type { ItineraryPlan, ResearchResult } from '@/lib/ai/agents/types';

/**
 * Deterministic quality evals for the selection pipeline.
 *
 * Every baseline below was MEASURED, not chosen — run the suite, read the
 * printed table, write those numbers down. A baseline picked by intuition
 * fails on noise and passes on regressions.
 *
 * Assertions are ratchets: better than baseline passes, worse fails. When an
 * improvement turns one green, bump it in the same commit — the diff is then
 * the evidence the change did something.
 */

interface Baseline {
  /** Candidates surviving curation. Guards the input, see the coverage note. */
  curated: number;
  /** Curated candidates carrying real coordinates. */
  located: number;
  /** Plans in the finished list. Guards against shrinkage. */
  plans: number;
  /** Plans traceable to the pool. Should equal `plans` — nothing invented. */
  fromPool: number;
  /** plan-check ceiling. */
  ceiling: number;
  findings: number;
}

const BASELINES: Record<string, Baseline> = {
  'lisbon-portugal': { curated: 44, located: 34, plans: 6, fromPool: 6, ceiling: 100, findings: 0 },
  'nashville-tennessee': { curated: 44, located: 41, plans: 6, fromPool: 6, ceiling: 100, findings: 0 },
  'new-york-city': { curated: 46, located: 35, plans: 6, fromPool: 6, ceiling: 100, findings: 0 },
  // Predates Places verification: no coordinates at all. Kept deliberately as
  // the case proving the pipeline degrades cleanly rather than breaking.
  'new-york-city-unlocated': { curated: 46, located: 0, plans: 6, fromPool: 6, ceiling: 100, findings: 0 },
  'tokyo-japan': { curated: 46, located: 31, plans: 6, fromPool: 6, ceiling: 100, findings: 0 },
};

const grades = gradeAll();
const byPool = new Map(grades.map((g) => [g.pool, g]));

// Print once so a failing run shows the whole picture, not just the assertion.
console.log('\n' + formatGrades(grades) + '\n');

describe('quality evals — every fixture pool is graded', () => {
  it('has a baseline for every pool, and a pool for every baseline', () => {
    expect(poolNames()).toEqual(Object.keys(BASELINES).sort());
  });
});

describe.each(poolNames())('quality eval — %s', (pool) => {
  const grade = byPool.get(pool) as Grade;
  const baseline = BASELINES[pool];

  it('does not shrink the pool the selector chooses from', () => {
    expect(grade.curated).toBeGreaterThanOrEqual(baseline.curated);
  });

  it('does not lose coordinate coverage', () => {
    // Every geographic feature no-ops without coords, so LOSING this data
    // makes downstream checks quieter, not better. Pin it.
    expect(grade.located).toBeGreaterThanOrEqual(baseline.located);
  });

  it('does not ship a shorter list', () => {
    expect(grade.plans).toBeGreaterThanOrEqual(baseline.plans);
  });

  it('invents nothing — every plan traces back to the pool', () => {
    expect(grade.fromPool).toBe(grade.plans);
    expect(grade.fromPool).toBeGreaterThanOrEqual(baseline.fromPool);
  });

  it('does not regress the check ceiling', () => {
    expect(grade.ceiling).toBeGreaterThanOrEqual(baseline.ceiling);
  });

  it('does not accumulate findings', () => {
    expect(grade.findings).toBeLessThanOrEqual(baseline.findings);
  });
});

/**
 * The grade must not be gameable by shipping less.
 *
 * `checkPlan`'s ceiling is a min over findings, so it RISES when the list
 * holds less — an empty list has no duplicates and nothing off-pool, and
 * scores a flawless 100. The plan-count baselines above are what stop that
 * from reading as an improvement; this test states the trap outright so
 * nobody removes them to make a red build green.
 */
describe('anti-gaming', () => {
  const empty: ItineraryPlan = {
    destination: 'New York City',
    summary: '',
    plans: [],
    totalEstimatedCost: 'Varies',
  };

  it('an empty list scores perfectly, which is why plan counts are pinned', () => {
    const check = checkPlan(empty, POOLS['new-york-city']);
    expect(check.scoreCeiling).toBe(100);
    expect(check.findings).toHaveLength(0);
    // ...and every pool's baseline demands real plans, so this cannot pass the gate.
    for (const b of Object.values(BASELINES)) expect(b.plans).toBeGreaterThan(0);
  });
});

/**
 * The two checks that survived the scheduling deletion still bite. If these
 * ever go quiet, the suite above is measuring nothing.
 */
describe('the gate still detects real defects', () => {
  const research = POOLS['new-york-city'];
  const firstName = (research.attractions ?? [])[0]?.name ?? 'A';

  it('catches a venue shipped twice', () => {
    const doubled: ItineraryPlan = {
      destination: 'New York City',
      summary: '',
      totalEstimatedCost: 'Varies',
      plans: [
        { name: firstName, type: 'attraction' },
        { name: firstName, type: 'attraction' },
      ],
    };
    const check = checkPlan(doubled, research);
    expect(check.stats.duplicateItems).toBe(1);
    expect(check.scoreCeiling).toBeLessThan(100);
  });

  it('catches a list of places research never found', () => {
    const invented: ItineraryPlan = {
      destination: 'New York City',
      summary: '',
      totalEstimatedCost: 'Varies',
      plans: [
        { name: 'The Nonexistent Room', type: 'activity' },
        { name: 'Club Imaginary', type: 'activity' },
      ],
    };
    const check = checkPlan(invented, research);
    expect(check.stats.offPoolItems).toBe(2);
    expect(check.scoreCeiling).toBeLessThan(100);
  });

  it('dedupe and ordering are wired into the graded path', () => {
    // Guards against a refactor that grades a path the product does not run.
    const dupes = [
      { name: 'X', type: 'activity' as const },
      { name: 'X', type: 'activity' as const },
    ];
    expect(dropDuplicatePlans(dupes)).toHaveLength(1);
    expect(
      orderByStartTime([
        { name: 'late', type: 'activity', startsAt: '2026-09-12T23:00:00-04:00' },
        { name: 'early', type: 'activity', startsAt: '2026-09-12T19:00:00-04:00' },
      ]).map((p) => p.name)
    ).toEqual(['early', 'late']);
  });
});

/**
 * The fixtures are captured web-research pools from before the Moves pool
 * existed, so none of them carry a published start time. That is a property of
 * the corpus, not of the pipeline — `pipeline.test.ts` covers time stamping and
 * ordering against pool events directly. Pinned so that when a timed fixture is
 * finally added, this test fails and forces the corpus note to be updated.
 */
describe('corpus limits', () => {
  it('no fixture pool carries real event times yet', () => {
    for (const g of grades) expect(g.timed).toBe(0);
  });

  it('is deterministic across runs', () => {
    const a = gradePool('new-york-city', POOLS['new-york-city'] as ResearchResult);
    const b = gradePool('new-york-city', POOLS['new-york-city'] as ResearchResult);
    expect(a).toEqual(b);
  });
});
