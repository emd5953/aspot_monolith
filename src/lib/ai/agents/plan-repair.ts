/**
 * Deterministic plan repair.
 *
 * `plan-audit` established that mechanical quality is computed in code, not
 * judged by a model. This is the other half of that idea: most of what the
 * audit detects also has a mechanical *fix*, and paying a `gpt-4o` revision
 * round-trip to apply it is both slower and less reliable than doing it here.
 *
 * The revision path could never carry this load anyway. It runs once, only on
 * the iteration the orchestrator stops on, only when the review came back
 * unapproved with a high-severity issue — and the result is then rejected
 * outright unless it holds coverage and audits no worse. So in fast mode
 * (`maxIterations = 1`, the default path) a plan with a backwards clock or an
 * empty afternoon usually just shipped with it.
 *
 * Every repair here is a fact-driven rewrite with a known-correct answer:
 *
 *   - times that run backwards      → sort the bucket chronologically
 *   - an item scheduled when shut   → move it to a bucket where it is open
 *   - the same venue booked twice   → replace the later one from the day's pool
 *   - an empty bucket               → refill from the day's unused pool
 *
 * None of them need judgment, so none of them need a model. What is left for
 * the LLM reviewer is what it is actually good at: whether the plan is any
 * good.
 *
 * Pure and I/O-free. Returns new day objects and reports what it changed, so
 * the caller can re-audit and show its work.
 */

import { ItineraryPlan, ResearchResult, ScheduledItem, DayPlan } from './types';
import { dedupeKey } from '../provenance';
import { refillBucket, type DayPool } from './pool-partition';
import { isOpenAt, type WeeklyHours } from '@/lib/maps/place-verification';

export interface RepairResult {
  plan: ItineraryPlan;
  /** Human-readable log of every change, for the orchestrator's thought trail. */
  repairs: string[];
}

type Bucket = 'morning' | 'afternoon' | 'evening';
const BUCKETS: Bucket[] = ['morning', 'afternoon', 'evening'];

/**
 * Representative time for each bucket, used when an item has to move buckets.
 * Deliberately mid-window: a venue that opens at 18:00 should land at 19:00,
 * not at the 17:00 boundary where it is still shut.
 */
const BUCKET_TIME: Record<Bucket, string> = {
  morning: '10:00',
  afternoon: '14:00',
  evening: '19:00',
};

const BUCKET_MINUTES: Record<Bucket, number> = {
  morning: 10 * 60,
  afternoon: 14 * 60,
  evening: 19 * 60,
};

/** "HH:MM" → minutes since midnight, or null when unparseable. */
function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time?.trim() ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function weekdayOf(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date ?? '')) return null;
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getUTCDay();
}

/** name → published hours for everything Place Details resolved. */
function buildHoursIndex(research: ResearchResult): Map<string, WeeklyHours> {
  const index = new Map<string, WeeklyHours>();
  for (const item of [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]) {
    const key = dedupeKey(item.name);
    if (key && item.openingHours?.length && !index.has(key)) {
      index.set(key, item.openingHours);
    }
  }
  return index;
}

/**
 * Sort a bucket chronologically.
 *
 * Items with unparseable times keep their relative position at the end rather
 * than being dropped or sorted to the front — the audit only complains about
 * times it could read, and a missing time is not a wrong one.
 */
export function sortBucketChronologically(items: ScheduledItem[]): ScheduledItem[] {
  const timed = items
    .map((item, i) => ({ item, i, at: toMinutes(item.time) }))
    .filter((x): x is { item: ScheduledItem; i: number; at: number } => x.at !== null);
  const untimed = items.filter((item) => toMinutes(item.time) === null);

  timed.sort((a, b) => (a.at === b.at ? a.i - b.i : a.at - b.at));
  return [...timed.map((t) => t.item), ...untimed];
}

/**
 * The bucket an item should sit in given its published hours, or null when it
 * is fine where it is (or when no bucket works).
 *
 * Prefers the latest workable bucket for a venue that is shut in the morning,
 * because the overwhelmingly common case is a bar or dinner restaurant landing
 * before noon — and evening is where it belongs, not merely where it is open.
 */
function findOpenBucket(
  hours: WeeklyHours,
  weekday: number,
  current: Bucket
): Bucket | null {
  if (isOpenAt(hours, weekday, BUCKET_MINUTES[current])) return null;
  const order: Bucket[] =
    current === 'morning' ? ['evening', 'afternoon'] : ['evening', 'afternoon', 'morning'];
  for (const bucket of order) {
    if (bucket !== current && isOpenAt(hours, weekday, BUCKET_MINUTES[bucket])) {
      return bucket;
    }
  }
  return null;
}

/**
 * Apply every mechanical repair to a plan.
 *
 * `pools` is the same per-day partition the planner built from, so replacements
 * and refills come from that day's own (geo-clustered) slice and don't undo the
 * geographic work. `used` tracks venue keys across the whole trip so a repair
 * can never introduce the duplicate it was called to remove.
 */
export function repairPlan(
  plan: ItineraryPlan,
  research: ResearchResult,
  pools: DayPool[]
): RepairResult {
  const repairs: string[] = [];
  const hoursIndex = buildHoursIndex(research);
  const hoursFor = (item: ScheduledItem): WeeklyHours | undefined =>
    hoursIndex.get(dedupeKey(item.name));

  // Everything already booked, so replacements and refills stay unique.
  const used = new Set<string>();
  for (const day of plan.days ?? []) {
    for (const bucket of BUCKETS) {
      for (const item of day[bucket] ?? []) {
        const key = dedupeKey(item.name);
        if (key) used.add(key);
      }
    }
  }

  // Trip-level, not per-day: the audit's duplicate finding fires across days
  // ("already on day 2"), so a per-day set would leave exactly the case that
  // matters unrepaired. Days are visited in order, so the first occurrence
  // always wins and the later one is the one dropped.
  const seenTrip = new Set<string>();

  const days: DayPlan[] = (plan.days ?? []).map((day, dayIdx) => {
    const pool = pools[dayIdx] ?? { attractions: [], restaurants: [], activities: [] };
    const weekday = weekdayOf(day.date);
    const next: Record<Bucket, ScheduledItem[]> = {
      morning: [...(day.morning ?? [])],
      afternoon: [...(day.afternoon ?? [])],
      evening: [...(day.evening ?? [])],
    };

    // ── 1. Duplicates ──────────────────────────────────────────────────────
    for (const bucket of BUCKETS) {
      next[bucket] = next[bucket].filter((item) => {
        const key = dedupeKey(item.name);
        if (!key) return true;
        if (seenTrip.has(key)) {
          repairs.push(
            `Day ${day.dayNumber}: dropped duplicate "${item.name}" from the ${bucket}.`
          );
          return false;
        }
        seenTrip.add(key);
        return true;
      });
    }

    // ── 2. Venues scheduled when they are shut ─────────────────────────────
    if (weekday !== null) {
      for (const bucket of BUCKETS) {
        const staying: ScheduledItem[] = [];
        for (const item of next[bucket]) {
          const hours = hoursFor(item);
          if (!hours || hours.length === 0) {
            staying.push(item);
            continue;
          }
          const target = findOpenBucket(hours, weekday, bucket);
          if (!target) {
            staying.push(item);
            continue;
          }
          next[target].push({ ...item, time: BUCKET_TIME[target] });
          repairs.push(
            `Day ${day.dayNumber}: moved "${item.name}" from the ${bucket} to the ${target} — it is closed at ${item.time}.`
          );
        }
        next[bucket] = staying;
      }
    }

    // ── 3. Empty buckets ───────────────────────────────────────────────────
    // Runs after the moves above, which can empty the bucket they moved out of.
    for (const bucket of BUCKETS) {
      if (next[bucket].length > 0) continue;
      const item = refillBucket(bucket, pool, used);
      if (item) {
        next[bucket] = [item];
        repairs.push(
          `Day ${day.dayNumber}: refilled the empty ${bucket} with "${item.name}".`
        );
      }
    }

    // ── 4. Chronology ──────────────────────────────────────────────────────
    // Last, so it also orders anything the earlier repairs inserted.
    for (const bucket of BUCKETS) {
      const before = next[bucket].map((i) => i.name).join('|');
      next[bucket] = sortBucketChronologically(next[bucket]);
      if (next[bucket].map((i) => i.name).join('|') !== before) {
        repairs.push(`Day ${day.dayNumber}: re-sorted the ${bucket} chronologically.`);
      }
    }

    return { ...day, ...next };
  });

  return { plan: { ...plan, days }, repairs };
}
