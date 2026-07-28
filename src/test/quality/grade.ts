/**
 * Deterministic quality grader for the generation pipeline.
 *
 * This is the programmatic half of an eval suite. There is no model in the
 * loop: it runs the real partition → assemble → repair path over a real
 * research pool and reports `auditPlan`'s findings. Same input, same number,
 * every time — which is what makes it usable as a CI gate.
 *
 * It grades the *mechanical* floor only: duplicates, geography, meals,
 * chronology, opening hours, provenance. It says nothing about whether a trip
 * is interesting or on-theme. A plan can grade a clean 100 and still be four
 * days of tourist-trap sludge in the right order — judging that needs an LLM
 * judge or a human, and belongs in a separate suite.
 *
 * The day assembly deliberately uses `buildFallbackDay` rather than the LLM
 * planner. That keeps the grade a measurement of everything downstream of the
 * model — partitioning, repair, audit — instead of a measurement of today's
 * sampling luck. A model-in-the-loop eval is a different, non-deterministic
 * tool; this one has to be stable enough to fail a build.
 */

import lisbonPortugal from '../fixtures/research/lisbon-portugal.json';
import nashvilleTennessee from '../fixtures/research/nashville-tennessee.json';
import newYorkCity from '../fixtures/research/new-york-city.json';
import newYorkCityUnlocated from '../fixtures/research/new-york-city-unlocated.json';
import tokyoJapan from '../fixtures/research/tokyo-japan.json';
import {
  partitionResearchAcrossDays,
  buildFallbackDay,
} from '@/lib/ai/agents/pool-partition';
import { auditPlan } from '@/lib/ai/agents/plan-audit';
import { repairPlan } from '@/lib/ai/agents/plan-repair';
import { curateResearchByPreferences } from '@/lib/preferences/score-research';
import type { ItineraryPlan, ResearchResult } from '@/lib/ai/agents/types';
import type { UserPreferences } from '@/types/quiz';

/**
 * The graded corpus, imported rather than read off disk — the grade must not
 * depend on which directory the runner started in, and an explicit registry
 * makes it obvious what is being measured.
 *
 * Each entry is a real research pool captured from a live generation.
 * `new-york-city-unlocated` predates Places verification and carries no
 * coordinates at all; it is kept deliberately, as the case that proves the
 * pipeline degrades cleanly instead of breaking when geo data is missing.
 *
 * The double cast is not laziness: this is captured production data, and it
 * disagrees with the declared contract in one place — research sometimes emits
 * `rating: null` where `AttractionData.rating` is `number | undefined`. Widening
 * the cast keeps the fixtures byte-faithful to what the pipeline really
 * receives, which is the whole point of grading against them. Narrowing the
 * data to satisfy the type would hide the mismatch instead of measuring it.
 */
export const POOLS: Record<string, ResearchResult> = {
  'lisbon-portugal': lisbonPortugal as unknown as ResearchResult,
  'nashville-tennessee': nashvilleTennessee as unknown as ResearchResult,
  'new-york-city': newYorkCity as unknown as ResearchResult,
  'new-york-city-unlocated': newYorkCityUnlocated as unknown as ResearchResult,
  'tokyo-japan': tokyoJapan as unknown as ResearchResult,
};

/** Trip shape every pool is graded at. Fixed so grades stay comparable. */
export const TRIP_DAYS = 4;

/** Monday. Chosen on purpose — it is when "closed today" venues bite. */
export const START_DATE = '2026-09-14';

/**
 * A deliberately middle-of-the-road traveller. The grader measures mechanical
 * correctness, which should hold for any profile; a distinctive profile would
 * just make the curated pool smaller and the grade noisier.
 */
export const GRADING_PREFERENCES = {
  activityTypes: ['museums', 'food'],
  cuisinePreferences: ['local'],
  travelMotivations: ['culture'],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  comfortZone: 5,
} as unknown as UserPreferences;

export interface Grade {
  pool: string;
  destination: string;
  /** Curated pool size and how much of it Places resolved. */
  items: number;
  located: number;
  withHours: number;
  geoClustered: boolean;
  /** Audit results before and after the deterministic repair pass. */
  ceilingBefore: number;
  ceilingAfter: number;
  findingsBefore: number;
  findingsAfter: number;
  maxDaySpreadKm: number;
  /** Scheduled items that survive to the final plan. */
  scheduledItems: number;
  /** Buckets left empty because the pool had nothing open to offer. */
  emptyBuckets: number;
  repairs: string[];
  remaining: string[];
}

export function poolNames(): string[] {
  return Object.keys(POOLS).sort();
}

function countItems(plan: ItineraryPlan): number {
  return plan.days.reduce(
    (n, d) => n + d.morning.length + d.afternoon.length + d.evening.length,
    0
  );
}

function countEmptyBuckets(plan: ItineraryPlan): number {
  return plan.days.reduce(
    (n, d) =>
      n +
      (d.morning.length === 0 ? 1 : 0) +
      (d.afternoon.length === 0 ? 1 : 0) +
      (d.evening.length === 0 ? 1 : 0),
    0
  );
}

/** Run the full deterministic path over one pool and grade the result. */
export function gradePool(name: string): Grade {
  const raw = POOLS[name];
  if (!raw) throw new Error(`Unknown pool "${name}" — add it to POOLS.`);

  const curated = curateResearchByPreferences(
    raw,
    GRADING_PREFERENCES,
    {
      attractionLimit: Math.max(12, TRIP_DAYS * 4),
      restaurantLimit: Math.max(10, TRIP_DAYS * 3),
      activityLimit: Math.max(8, TRIP_DAYS * 2),
    },
    undefined
  );

  const all = [...curated.attractions, ...curated.restaurants, ...curated.activities];
  const { pools, geoClustered } = partitionResearchAcrossDays(curated, TRIP_DAYS);

  const start = new Date(`${START_DATE}T00:00:00Z`);
  const days = pools.map((pool, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    return {
      ...buildFallbackDay(i + 1, `Day ${i + 1}`, pool),
      date: date.toISOString().slice(0, 10),
    };
  });

  const plan: ItineraryPlan = {
    destination: curated.destination,
    summary: `${TRIP_DAYS}-day graded plan`,
    totalEstimatedCost: '$$',
    days,
  };

  const before = auditPlan(plan, curated);
  const repaired = repairPlan(plan, curated, pools);
  const after = auditPlan(repaired.plan, curated);

  return {
    pool: name,
    destination: curated.destination,
    items: all.length,
    located: all.filter((i) => i.coordinates).length,
    withHours: all.filter((i) => i.openingHours?.length).length,
    geoClustered,
    ceilingBefore: before.scoreCeiling,
    ceilingAfter: after.scoreCeiling,
    findingsBefore: before.findings.length,
    findingsAfter: after.findings.length,
    maxDaySpreadKm: after.stats.maxDaySpreadKm,
    scheduledItems: countItems(repaired.plan),
    emptyBuckets: countEmptyBuckets(repaired.plan),
    repairs: repaired.repairs,
    remaining: after.findings.map((f) => `[${f.severity}] ${f.issue}`),
  };
}

/** Grade every fixture pool. */
export function gradeAll(): Grade[] {
  return poolNames().map(gradePool);
}

/** Render grades as a table for the console. */
export function formatGrades(grades: Grade[]): string {
  const header = [
    'pool'.padEnd(24),
    'items'.padStart(6),
    'loc%'.padStart(5),
    'hrs'.padStart(4),
    'geo'.padStart(5),
    'ceiling'.padStart(10),
    'findings'.padStart(10),
    'sched'.padStart(6),
    'empty'.padStart(6),
  ].join(' ');

  const rows = grades.map((g) =>
    [
      g.pool.padEnd(24),
      String(g.items).padStart(6),
      `${Math.round((100 * g.located) / Math.max(g.items, 1))}%`.padStart(5),
      String(g.withHours).padStart(4),
      String(g.geoClustered).padStart(5),
      `${g.ceilingBefore}→${g.ceilingAfter}`.padStart(10),
      `${g.findingsBefore}→${g.findingsAfter}`.padStart(10),
      String(g.scheduledItems).padStart(6),
      String(g.emptyBuckets).padStart(6),
    ].join(' ')
  );

  return [header, '─'.repeat(header.length), ...rows].join('\n');
}
