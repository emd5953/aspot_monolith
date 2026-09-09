import { dedupeKey } from '../provenance';
import type { PlanItem } from './types';

/**
 * Ordering for a Move-list.
 *
 * Spotz does not schedule. It selects real events and shows them in the order
 * they actually start, using the time the source published. Plans whose source
 * announced no time (a bar, a restaurant, a web-research pick) sort last —
 * absent means UNKNOWN, and an unknown time is not "starts at midnight".
 *
 * Pure and model-free so ordering is testable without a network call, and so
 * two runs over the same picks always agree.
 */

/**
 * Sort plans by real start time ascending, untimed last, ties stable.
 *
 * Stability matters: ties keep the order the ranker produced, so equal-time
 * events stay in fit order rather than being shuffled by the sort. Returns a
 * new array — callers rely on the input being untouched.
 */
export function orderByStartTime(plans: PlanItem[]): PlanItem[] {
  return plans
    .map((plan, index) => ({ plan, index, at: parseStart(plan.startsAt) }))
    .sort((a, b) => {
      // Untimed sinks below everything timed, regardless of index.
      if (a.at === undefined && b.at === undefined) return a.index - b.index;
      if (a.at === undefined) return 1;
      if (b.at === undefined) return -1;
      // Equal times fall back to rank order — Array.sort is not guaranteed
      // stable across engines for all inputs, so make it explicit.
      return a.at - b.at || a.index - b.index;
    })
    .map((entry) => entry.plan);
}

/**
 * ISO string → epoch ms, or undefined when absent or unparseable.
 *
 * A malformed timestamp is treated as unknown rather than as epoch 0, which
 * would silently pin a broken row to the top of the night.
 */
function parseStart(iso?: string): number | undefined {
  if (!iso) return undefined;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Drop repeat venues, keeping the first (best-ranked) appearance.
 *
 * Name comparison goes through `dedupeKey` — the same normalizer the rest of
 * the pipeline uses — because "The Bluebird Cafe" and "Bluebird Cafe" once
 * shipped as two separate stops.
 */
export function dropDuplicatePlans(plans: PlanItem[]): PlanItem[] {
  const seen = new Set<string>();
  const kept: PlanItem[] = [];
  for (const plan of plans) {
    const key = dedupeKey(plan.name);
    // An unkeyable name can't be compared; keep it rather than silently drop.
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    kept.push(plan);
  }
  return kept;
}
