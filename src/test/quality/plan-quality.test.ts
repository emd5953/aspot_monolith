import { describe, it, expect } from 'vitest';
import { gradeAll, gradePool, formatGrades, poolNames, type Grade } from './grade';

/**
 * Deterministic quality evals for the generation pipeline.
 *
 * The grader is programmatic — `auditPlan`, no model, no judge — so these are
 * stable enough to gate a build. They measure the mechanical floor: duplicates,
 * geography, meals, chronology, opening hours, provenance. They say nothing
 * about whether a trip is *good*. That needs a judge or a human and belongs in
 * a separate, non-deterministic suite.
 *
 * Every baseline below was measured, not chosen. Assertions are ratchets:
 * better than baseline passes, worse fails. When you improve the pipeline these
 * go green and you bump the numbers — the diff is then the evidence that the
 * change did something.
 *
 * WHY THIS EXISTS: the three bugs in the repair pass were caught by reading
 * real output and recognizing that The High Line does not close on Mondays.
 * That does not scale and does not survive a change of maintainer. These
 * assertions catch the same class of defect structurally, in 300ms, without
 * anyone needing to know the venues.
 */

interface Baseline {
  /** Audit score ceiling after repair. Higher is better. */
  ceiling: number;
  /** Findings remaining after repair. Lower is better. */
  findings: number;
  /** Scheduled items surviving to the final plan. Guards against shrinkage. */
  scheduledItems: number;
  /** Buckets left empty because the pool had nothing open. Lower is better. */
  emptyBuckets: number;
  /** Whether the pool has enough located items to cluster days by area. */
  geoClustered: boolean;
  /** Pool coverage. Guards the *inputs* — see the anti-gaming test below. */
  located: number;
  withHours: number;
}

const BASELINES: Record<string, Baseline> = {
  'lisbon-portugal': {
    ceiling: 80,
    findings: 1,
    scheduledItems: 24,
    emptyBuckets: 0,
    geoClustered: true,
    located: 27,
    withHours: 0,
  },
  'nashville-tennessee': {
    ceiling: 80,
    findings: 2,
    scheduledItems: 19,
    emptyBuckets: 0,
    geoClustered: true,
    located: 30,
    withHours: 0,
  },
  'new-york-city': {
    ceiling: 80,
    findings: 4,
    scheduledItems: 23,
    emptyBuckets: 1,
    geoClustered: true,
    located: 29,
    withHours: 22,
  },
  // No coordinates and no hours at all — captured before Places verification.
  // Its clean grade is NOT a quality signal; see the anti-gaming test.
  'new-york-city-unlocated': {
    ceiling: 100,
    findings: 0,
    scheduledItems: 24,
    emptyBuckets: 0,
    geoClustered: false,
    located: 0,
    withHours: 0,
  },
  'tokyo-japan': {
    ceiling: 65,
    findings: 4,
    scheduledItems: 24,
    emptyBuckets: 0,
    geoClustered: true,
    located: 26,
    withHours: 0,
  },
};

const grades = gradeAll();
const byPool = new Map(grades.map((g) => [g.pool, g]));

// Print the table once so a regression run shows the current state, not just
// which assertion tripped.
console.log('\n' + formatGrades(grades) + '\n');

describe('quality evals — every fixture pool is graded', () => {
  it('has a baseline for every pool, and a pool for every baseline', () => {
    expect(poolNames()).toEqual(Object.keys(BASELINES).sort());
  });
});

describe.each(poolNames())('quality eval — %s', (pool) => {
  const grade = byPool.get(pool) as Grade;
  const baseline = BASELINES[pool];

  it('does not regress the audit score ceiling', () => {
    expect(grade.ceilingAfter).toBeGreaterThanOrEqual(baseline.ceiling);
  });

  it('does not accumulate new findings', () => {
    expect(grade.findingsAfter).toBeLessThanOrEqual(baseline.findings);
  });

  // A pass that "fixes" the plan by deleting most of it would ace every check
  // above. The audit's ceiling is a min over findings, so it goes *up* when
  // the plan holds less — exactly the failure mode the orchestrator's coverage
  // guard exists for. Pin the item count too.
  it('does not shrink the itinerary', () => {
    expect(grade.scheduledItems).toBeGreaterThanOrEqual(baseline.scheduledItems);
  });

  it('does not leave more empty buckets', () => {
    expect(grade.emptyBuckets).toBeLessThanOrEqual(baseline.emptyBuckets);
  });

  it('still clusters days geographically when the pool allows it', () => {
    expect(grade.geoClustered).toBe(baseline.geoClustered);
  });

  it('repair never audits worse than the plan it was given', () => {
    expect(grade.ceilingAfter).toBeGreaterThanOrEqual(grade.ceilingBefore);
    expect(grade.findingsAfter).toBeLessThanOrEqual(grade.findingsBefore);
  });
});

/**
 * The metric is only as honest as its inputs.
 *
 * Every geographic check in `plan-audit` no-ops without coordinates, and the
 * hours check no-ops without hours — so *losing* that data makes the score go
 * UP. `new-york-city-unlocated` demonstrates it: a flawless 100/0 findings
 * purely because nothing can be seen. If Places verification silently broke,
 * every pool would drift toward that state and the ceilings would improve.
 *
 * Pinning coverage is what stops a blindness regression from reading as a win.
 */
describe('quality evals — coverage cannot silently drop', () => {
  it.each(poolNames())('%s keeps its located-item coverage', (pool) => {
    const grade = byPool.get(pool) as Grade;
    expect(grade.located).toBeGreaterThanOrEqual(BASELINES[pool].located);
  });

  it.each(poolNames())('%s keeps its opening-hours coverage', (pool) => {
    const grade = byPool.get(pool) as Grade;
    expect(grade.withHours).toBeGreaterThanOrEqual(BASELINES[pool].withHours);
  });

  it('the unlocated pool scores clean only because it is blind', () => {
    const blind = byPool.get('new-york-city-unlocated') as Grade;
    const seeing = byPool.get('new-york-city') as Grade;

    // Same city, same trip length. The one we can see has real defects; the one
    // we cannot see looks perfect. That is the trap this suite guards.
    expect(blind.ceilingAfter).toBe(100);
    expect(blind.located).toBe(0);
    expect(seeing.located).toBeGreaterThan(0);
    expect(seeing.findingsAfter).toBeGreaterThan(blind.findingsAfter);
  });
});

describe('quality evals — the grader itself', () => {
  it('is deterministic across runs', () => {
    for (const pool of poolNames()) {
      expect(gradePool(pool)).toEqual(gradePool(pool));
    }
  });

  it('actually exercises the repair pass on the pools that need it', () => {
    // If this goes quiet, repair stopped running rather than stopped being
    // needed — the findings baselines above assume it fires.
    const nyc = byPool.get('new-york-city') as Grade;
    expect(nyc.repairs.length).toBeGreaterThan(0);
    expect(nyc.repairs.some((r) => r.includes('closed all day'))).toBe(true);
  });
});
