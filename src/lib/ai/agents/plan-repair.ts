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
import { isOnTheme, themeScore, anchorBucket, ANCHOR_TIME } from './theme';

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

/**
 * The meal scaffold.
 *
 * A day in a city has a shape, and meals are the fixed points it hangs off —
 * not optional extras the planner may skip when it finds something more
 * interesting. Sightseeing is what fills the gaps *between* them.
 *
 * Breakfast is deliberately absent. Plenty of travellers skip it or eat at the
 * hotel, and for a late theme the honest answer is brunch rather than an 08:00
 * booking, so requiring it would manufacture filler nobody uses.
 *
 * `window` is what counts as that meal (matching the audit's check); `at` is
 * where a missing one gets inserted.
 *
 * Dinner is listed first on purpose. Meals are filled in this order and the
 * pool can run dry, so the order decides who wins when only one restaurant is
 * left — and if a traveller gets exactly one sit-down meal that day, it should
 * be dinner. Lunch-first quietly spent the last restaurant at 13:00 and left
 * the evening with nowhere to eat.
 */
const MEALS: Array<{
  name: 'lunch' | 'dinner';
  bucket: Bucket;
  window: [number, number];
  at: number;
}> = [
  { name: 'dinner', bucket: 'evening', window: [17 * 60, 22 * 60], at: 19 * 60 },
  { name: 'lunch', bucket: 'afternoon', window: [11 * 60, 15 * 60], at: 13 * 60 },
];

/** 780 → "13:00". */
function fmtMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

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
 * Where a venue that is shut at its scheduled time could go instead, or null
 * when no bucket on this day works.
 *
 * Callers must establish that the item is actually misplaced before calling —
 * "leave it alone" and "nowhere works" are different answers and must not share
 * a return value. An earlier version folded the open check in here and returned
 * null for both; the caller read every null as closed-all-day and dropped The
 * High Line, Eataly, and The Cloisters out of a real NYC plan. Hence the split.
 *
 * Prefers the latest workable bucket, because the overwhelmingly common case is
 * a bar or dinner restaurant landing before noon — and evening is where it
 * belongs, not merely where it is open.
 */
export function findOpenBucket(
  hours: WeeklyHours,
  weekday: number,
  current: Bucket
): Bucket | null {
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
  pools: DayPool[],
  userIntent?: string
): RepairResult {
  const repairs: string[] = [];
  const hoursIndex = buildHoursIndex(research);

  // A theme only counts if it is specific enough to match anything. A vague
  // intent would otherwise flag every day and anchor them all on noise.
  // Research's own classification for each candidate, recovered by name — the
  // planner drops it, and it is the strongest signal for theme fit.
  const categoryIndex = new Map<string, string>();
  for (const c of [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]) {
    const key = dedupeKey(c.name);
    const category =
      'category' in c && c.category
        ? c.category
        : 'cuisine' in c && c.cuisine?.length
          ? c.cuisine.join(' ')
          : undefined;
    if (key && category && !categoryIndex.has(key)) categoryIndex.set(key, category);
  }
  const itemOnTheme = (i: ScheduledItem) =>
    isOnTheme(
      `${i.name} ${i.description ?? ''}`,
      userIntent,
      categoryIndex.get(dedupeKey(i.name))
    );

  const themed = Boolean(userIntent) && isOnTheme(userIntent!, userIntent);
  const anchorSlot = anchorBucket(userIntent);
  const anchorMinutes =
    Number(ANCHOR_TIME[anchorSlot].slice(0, 2)) * 60 +
    Number(ANCHOR_TIME[anchorSlot].slice(3, 5));
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

    // How full each bucket should end up. Taken from the day as planned (never
    // below one) so a repair that *removes* something — a duplicate, or a venue
    // shut all day — is followed by a replacement instead of quietly shrinking
    // the day. Refills stop early when the pool runs dry.
    const target: Record<Bucket, number> = {
      morning: Math.max(1, next.morning.length),
      afternoon: Math.max(1, next.afternoon.length),
      evening: Math.max(1, next.evening.length),
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

          // Judge the item at the time it is actually scheduled — the same
          // instant the audit uses — falling back to the bucket's nominal time
          // when the item carries no readable one.
          const at = toMinutes(item.time) ?? BUCKET_MINUTES[bucket];
          if (isOpenAt(hours, weekday, at)) {
            staying.push(item);
            continue;
          }

          const moveTo = findOpenBucket(hours, weekday, bucket);
          if (moveTo) {
            next[moveTo].push({ ...item, time: BUCKET_TIME[moveTo] });
            repairs.push(
              `Day ${day.dayNumber}: moved "${item.name}" from the ${bucket} to the ${moveTo} — it is closed at ${item.time}.`
            );
            continue;
          }
          // Shut at every hour of this day — there is nowhere on the day to
          // move it to, so drop it and let the refill below put something open
          // in its place. Measured against the real NYC pool this is the
          // common case, not the rare one: a museum closed Mondays and two
          // markets that only run on weekends all shipped inside the plan.
          repairs.push(
            `Day ${day.dayNumber}: dropped "${item.name}" from the ${bucket} — it is closed all day.`
          );
        }
        next[bucket] = staying;
      }
    }

    // ── 3a. The theme's anchor ─────────────────────────────────────────────
    //
    // Placed before meals and before fill, because it is the most fixed point
    // there is: it is the thing the user actually asked for. A day that has
    // nothing serving the theme has failed at its only job, however tidy it
    // looks — a real house-music run returned The Elevated Acre, Smorgasburg,
    // and Coney Island, every one of which passes every other check.
    if (themed) {
      const onThemeIn = (b: Bucket) => next[b].findIndex(itemOnTheme);

      // Being present is not the same as being the spine. A real run anchored
      // a night-out theme on a bar at 10:00 — technically on-theme, useless as
      // a plan. So an anchor only counts when it sits in the slot the theme
      // belongs to, and an on-theme item found elsewhere is MOVED there rather
      // than leaving the day to be re-anchored on something else.
      let anchored = onThemeIn(anchorSlot) >= 0;

      if (!anchored) {
        for (const b of BUCKETS) {
          if (b === anchorSlot) continue;
          const idx = onThemeIn(b);
          if (idx < 0) continue;

          const moving = next[b][idx];
          const hours = hoursIndex.get(dedupeKey(moving.name));
          if (weekday !== null && hours?.length && !isOpenAt(hours, weekday, anchorMinutes)) {
            continue; // Right theme, but shut then — leave it where it works.
          }

          next[b] = next[b].filter((_, i) => i !== idx);
          next[anchorSlot].push({ ...moving, time: ANCHOR_TIME[anchorSlot] });
          target[anchorSlot] = Math.max(target[anchorSlot], next[anchorSlot].length);
          repairs.push(
            `Day ${day.dayNumber}: moved "${moving.name}" from the ${b} to the ${anchorSlot} at ${ANCHOR_TIME[anchorSlot]} — it is what the day is for.`
          );
          anchored = true;
          break;
        }
      }

      if (!anchored) {
        // Best on-theme candidate anywhere in the pool, day slice first. The
        // theme outranks geography for exactly one item per day: a themed trip
        // that keeps every day tidy and never delivers the theme is worse than
        // one that travels for the thing it promised.
        const candidates = [
          ...pool.activities,
          ...pool.attractions,
          ...pool.restaurants,
          ...(research.activities ?? []),
          ...(research.attractions ?? []),
          ...(research.restaurants ?? []),
        ];

        let best: { name: string; score: number; type: ScheduledItem['type'] } | null =
          null;
        for (const c of candidates) {
          if (used.has(dedupeKey(c.name))) continue;
          const category =
            'category' in c && c.category
              ? c.category
              : 'cuisine' in c && c.cuisine?.length
                ? c.cuisine.join(' ')
                : undefined;
          const text = `${c.name} ${'description' in c ? (c.description ?? '') : ''}`;
          if (!isOnTheme(text, userIntent, category)) continue;
          // Rank by literal match so a venue that names the theme outright
          // beats one that merely qualifies by venue kind. Both are eligible;
          // the wording is just better evidence.
          const score = themeScore(text, userIntent, category);
          if (weekday !== null) {
            const hours = hoursIndex.get(dedupeKey(c.name));
            if (hours?.length && !isOpenAt(hours, weekday, anchorMinutes)) continue;
          }
          if (!best || score > best.score) {
            best = {
              name: c.name,
              score,
              type: 'cuisine' in c ? 'restaurant' : 'activity',
            };
          }
        }

        if (best) {
          used.add(dedupeKey(best.name));
          next[anchorSlot].push({
            time: ANCHOR_TIME[anchorSlot],
            name: best.name,
            type: best.type,
            duration: 120,
          });
          target[anchorSlot] = Math.max(target[anchorSlot], next[anchorSlot].length);
          repairs.push(
            `Day ${day.dayNumber}: anchored the ${anchorSlot} on "${best.name}" — nothing served "${userIntent}".`
          );
        }
      }
    }

    // ── 3b. Meals are defaults, not extras ─────────────────────────────────
    // Measured across the five real research pools, 17 of 20 generated days
    // had no lunch at all — dinner only appeared because the evening refill
    // happens to prefer restaurants. Nothing in the pipeline treated a midday
    // meal as part of a day's shape, so nothing produced one.
    for (const meal of MEALS) {
      const alreadyEating = BUCKETS.some((b) =>
        next[b].some((item) => {
          if (item.type !== 'restaurant') return false;
          const at = toMinutes(item.time);
          return at !== null && at >= meal.window[0] && at <= meal.window[1];
        })
      );
      if (alreadyEating) continue;

      const eligible = (r: { name: string }) => {
        if (used.has(dedupeKey(r.name))) return false;
        if (weekday === null) return true;
        const hours = hoursIndex.get(dedupeKey(r.name));
        if (!hours || hours.length === 0) return true;
        return isOpenAt(hours, weekday, meal.at);
      };

      // The day's own geo-cluster slice first, so the meal stays near the rest
      // of the day. But a partitioned slice holds only a few restaurants and
      // can simply run out — which is why five days still had no lunch after
      // the scaffold went in. Meals are defaults; geography is the
      // optimization. So fall back to the whole pool rather than skip eating.
      const candidate =
        pool.restaurants.find(eligible) ?? (research.restaurants ?? []).find(eligible);
      if (!candidate) continue;

      used.add(dedupeKey(candidate.name));
      next[meal.bucket].push({
        time: fmtMinutes(meal.at),
        name: candidate.name,
        type: 'restaurant',
        duration: 75,
        description: candidate.mustTry ? `Known for: ${candidate.mustTry}` : undefined,
      });
      // The meal is a fixed point, so it raises the bucket's target rather
      // than consuming a slot that fill was going to use for something else.
      target[meal.bucket] = Math.max(target[meal.bucket], next[meal.bucket].length);
      repairs.push(
        `Day ${day.dayNumber}: added ${meal.name} at ${fmtMinutes(meal.at)} — "${candidate.name}".`
      );
    }

    // ── 3. Refill back up to target ────────────────────────────────────────
    // Runs after the moves and drops above, which are what create the holes.
    for (const bucket of BUCKETS) {
      // Only accept a candidate that is actually open then. A candidate with
      // no published hours is eligible — unknown is not closed — but one we
      // know is shut must never be used to plug a hole. Without this, repair
      // filled an empty NYC morning with a bar that opens at 17:00, trading an
      // "empty bucket" finding for a worse "closed when scheduled" one.
      const openThen = (candidate: { name: string }) => {
        if (weekday === null) return true;
        const hours = hoursIndex.get(dedupeKey(candidate.name));
        if (!hours || hours.length === 0) return true;
        return isOpenAt(hours, weekday, BUCKET_MINUTES[bucket]);
      };

      while (next[bucket].length < target[bucket]) {
        const item = refillBucket(bucket, pool, used, openThen);
        if (!item) break; // Pool exhausted — an honest hole beats a wrong pick.
        next[bucket].push(item);
        repairs.push(
          `Day ${day.dayNumber}: filled the ${bucket} with "${item.name}".`
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
