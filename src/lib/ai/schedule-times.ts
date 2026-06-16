/**
 * Assign concrete start/end times to a day's activities.
 *
 * The planner emits a time-ordered schedule (each item has an "HH:MM" start),
 * but those times were being dropped on the way to the database, leaving every
 * activity timeless. This restores them: honor the planner's time when it's
 * sane, otherwise lay activities out sequentially from a day start, always
 * keeping the schedule monotonic (no overlaps) and spacing in a little travel
 * time. Pure + unit-tested.
 */

export interface TimedItemInput {
  /** Planner-provided "HH:MM" start, if any. */
  time?: string;
  /** Activity length in minutes. */
  durationMin?: number;
}

export interface AssignedTime {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

const DEFAULT_DAY_START_MIN = 9 * 60; // 09:00
const DEFAULT_DURATION_MIN = 90;
const DEFAULT_TRAVEL_GAP_MIN = 20;

/** Parse "HH:MM" or "HH:MM:SS" to minutes-since-midnight, or null if invalid. */
export function parseHhMm(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes-since-midnight → "HH:MM", wrapping into a single day. */
export function formatHhMm(totalMin: number): string {
  const wrapped = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface AssignTimesOptions {
  dayStartMin?: number;
  travelGapMin?: number;
  defaultDurationMin?: number;
}

/**
 * Walk the day's items in order and assign each a start/end time.
 *
 * - A planner time is honored when it's at or after where the schedule has
 *   reached (so a deliberately-late dinner keeps its slot), but never earlier —
 *   that would overlap the previous activity, so we bump it to the cursor.
 * - Items without a usable time flow sequentially from the cursor.
 * - After each item the cursor advances past its end plus a travel gap.
 */
export function assignDayTimes(
  items: TimedItemInput[],
  options: AssignTimesOptions = {}
): AssignedTime[] {
  const dayStart = options.dayStartMin ?? DEFAULT_DAY_START_MIN;
  const gap = options.travelGapMin ?? DEFAULT_TRAVEL_GAP_MIN;
  const defaultDuration = options.defaultDurationMin ?? DEFAULT_DURATION_MIN;

  let cursor = dayStart;
  return items.map((item) => {
    const planned = parseHhMm(item.time);
    const start = planned != null && planned >= cursor ? planned : cursor;
    const duration = item.durationMin && item.durationMin > 0 ? item.durationMin : defaultDuration;
    const end = start + duration;
    cursor = end + gap;
    return { startTime: formatHhMm(start), endTime: formatHhMm(end) };
  });
}
