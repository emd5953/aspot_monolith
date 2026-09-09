/**
 * Deterministic quality grader for the selection pipeline.
 *
 * No model in the loop: it runs the real curate → check path over real
 * research pools and reports what came out. Same input, same number, every
 * time — which is what makes it usable as a CI gate.
 *
 * WHAT CHANGED. This suite used to grade a *schedule*: per-day geographic
 * spread, empty morning buckets, missing lunches, backwards clocks, venues
 * booked while shut. Spotz no longer schedules anything, so none of those
 * defects can occur and none of those baselines mean anything. What can still
 * go wrong is selection: shipping a venue twice, or naming a place research
 * never found. That is what this grades now.
 *
 * It says nothing about whether a night is any *good* — a list can grade a
 * clean 100 and still be four tourist traps in a row. Judging that needs an
 * LLM judge or a human and belongs in a separate, non-deterministic suite.
 */

import lisbonPortugal from '../fixtures/research/lisbon-portugal.json';
import nashvilleTennessee from '../fixtures/research/nashville-tennessee.json';
import newYorkCity from '../fixtures/research/new-york-city.json';
import newYorkCityUnlocated from '../fixtures/research/new-york-city-unlocated.json';
import tokyoJapan from '../fixtures/research/tokyo-japan.json';
import { checkPlan } from '@/lib/ai/agents/plan-check';
import { orderByStartTime, dropDuplicatePlans } from '@/lib/ai/agents/order-plans';
import { curateResearchByPreferences } from '@/lib/preferences/score-research';
import { lookupSource, buildProvenanceIndex } from '@/lib/ai/provenance';
import type { ItineraryPlan, PlanItem, ResearchResult } from '@/lib/ai/agents/types';
import type { UserPreferences } from '@/types/profile';

/**
 * The graded corpus, imported rather than read off disk — the grade must not
 * depend on which directory the runner started in, and an explicit registry
 * makes it obvious what is being measured.
 *
 * The double cast is not laziness: this is captured production data, and it
 * disagrees with the declared contract in one place — research sometimes emits
 * `rating: null` where `AttractionData.rating` is `number | undefined`.
 * Widening the cast keeps the fixtures byte-faithful to what the pipeline
 * really receives, which is the whole point of grading against them.
 */
export const POOLS: Record<string, ResearchResult> = {
  'lisbon-portugal': lisbonPortugal as unknown as ResearchResult,
  'nashville-tennessee': nashvilleTennessee as unknown as ResearchResult,
  'new-york-city': newYorkCity as unknown as ResearchResult,
  'new-york-city-unlocated': newYorkCityUnlocated as unknown as ResearchResult,
  'tokyo-japan': tokyoJapan as unknown as ResearchResult,
};

export function poolNames(): string[] {
  return Object.keys(POOLS).sort();
}

/**
 * A middle-of-the-road profile. The grader measures mechanical correctness,
 * which should hold for any profile; a distinctive one would just shrink the
 * curated pool and make the grade noisier.
 */
export const GRADING_PREFERENCES = {
  activityTypes: ['museums', 'food', 'culture'],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  comfortZone: 5,
} as unknown as UserPreferences;

export interface Grade {
  pool: string;
  /** Candidates the curation step kept. */
  curated: number;
  /** How many of those carry real coordinates. */
  located: number;
  /** How many carry a real published start time. */
  timed: number;
  /** Plans in the finished list. */
  plans: number;
  /** Plans traceable to the research pool (the rest are model recall). */
  fromPool: number;
  /** Repeat venues the dedupe step removed. */
  dropped: number;
  /** plan-check ceiling, 0-100. Higher is better. */
  ceiling: number;
  findings: number;
}

/**
 * Stand in for the model's selection, deterministically.
 *
 * The grader must measure everything around the LLM call without being at the
 * mercy of today's sampling, so it "selects" the top N of the curated pool in
 * rank order — exactly the set the model is choosing from. Putting a real
 * model here would make the number non-deterministic and unfit to gate a build.
 */
function selectTopN(research: ResearchResult, n: number): PlanItem[] {
  const provenance = buildProvenanceIndex([
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]);

  const picks: PlanItem[] = [
    ...(research.activities ?? []).map((a) => ({
      name: a.name,
      type: 'activity' as const,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    })),
    ...(research.restaurants ?? []).map((r) => ({
      name: r.name,
      type: 'restaurant' as const,
    })),
    ...(research.attractions ?? []).map((a) => ({
      name: a.name,
      type: 'attraction' as const,
    })),
  ].slice(0, n);

  return picks.map((p) => ({ ...p, source: lookupSource(p.name, provenance) }));
}

export function gradePool(pool: string, research: ResearchResult): Grade {
  const curated = curateResearchByPreferences(
    research,
    GRADING_PREFERENCES,
    { attractionLimit: 24, restaurantLimit: 24, activityLimit: 24 }
  );

  const all = [
    ...(curated.attractions ?? []),
    ...(curated.restaurants ?? []),
    ...(curated.activities ?? []),
  ];

  const selected = selectTopN(curated, 6);
  const deduped = dropDuplicatePlans(selected);
  const plans = orderByStartTime(deduped);

  const plan: ItineraryPlan = {
    destination: curated.destination,
    summary: 'graded selection',
    plans,
    totalEstimatedCost: 'Varies',
  };

  const check = checkPlan(plan, curated);

  return {
    pool,
    curated: all.length,
    located: all.filter((i) => i.coordinates).length,
    timed: plans.filter((p) => p.startsAt).length,
    plans: plans.length,
    fromPool: plans.length - check.stats.offPoolItems,
    dropped: selected.length - deduped.length,
    ceiling: check.scoreCeiling,
    findings: check.findings.length,
  };
}

export function gradeAll(): Grade[] {
  return poolNames().map((name) => gradePool(name, POOLS[name]));
}

export function formatGrades(grades: Grade[]): string {
  const header =
    'pool                      curated  loc  timed  plans  pool  dropped  ceiling  findings';
  const rule = '─'.repeat(header.length);
  const rows = grades.map((g) =>
    [
      g.pool.padEnd(24),
      String(g.curated).padStart(7),
      String(g.located).padStart(5),
      String(g.timed).padStart(6),
      String(g.plans).padStart(6),
      String(g.fromPool).padStart(5),
      String(g.dropped).padStart(8),
      String(g.ceiling).padStart(8),
      String(g.findings).padStart(9),
    ].join('')
  );
  return [header, rule, ...rows].join('\n');
}
