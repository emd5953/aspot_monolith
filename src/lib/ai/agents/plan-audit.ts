/**
 * Deterministic plan audit.
 *
 * The LLM reviewer is good at taste — does this day serve what the user asked
 * for, is the vibe right — and reliably bad at arithmetic. Left on its own it
 * scored 92/100 for a plan that booked the same venue on two consecutive days,
 * and 85/100 for a Lisbon day that crossed the city four times. Those aren't
 * judgment calls; they're facts you can compute. So we compute them here, hand
 * the reviewer the findings as ground truth, and cap the score it's allowed to
 * award. The LLM keeps the qualitative half of the job.
 *
 * This also unblocks the revise loop. The orchestrator stops as soon as the
 * score clears the threshold, so an inflated score meant deep mode's five
 * iterations always ended after one. A real ceiling makes iteration 2 happen.
 *
 * Pure and I/O-free — every check is unit-testable without a model call.
 */

import { ItineraryPlan, ResearchResult, ReviewIssue, ScheduledItem } from './types';
import { dedupeKey } from '../provenance';
import { haversineKm, LatLng } from '@/lib/itinerary/geo';

export interface AuditFinding extends ReviewIssue {
  /** Highest score a plan carrying this finding may be awarded. */
  scoreCeiling: number;
}

export interface PlanAudit {
  findings: AuditFinding[];
  /** Min of every finding's ceiling; 100 when the plan is mechanically clean. */
  scoreCeiling: number;
  /** Rendered for the reviewer prompt. */
  summary: string;
  stats: {
    totalItems: number;
    offPoolItems: number;
    maxDaySpreadKm: number;
  };
}

/**
 * Thresholds. Deliberately generous — this pass exists to catch plans that are
 * clearly broken, not to litigate taste. A day that spans 12km is a normal big
 * city day; one that spans 25km is a plan that ignored geography.
 */
const DAY_SPREAD_WARN_KM = 12;
const DAY_SPREAD_FAIL_KM = 25;
/** Beyond this from the trip's own centre, an item is a different trip. */
const OUT_OF_REGION_KM = 40;
/** Above this share of untraceable items, the plan is being invented. */
const OFF_POOL_WARN_RATIO = 0.4;

/**
 * Words that mark a venue as evening-only. Matched on word boundaries so
 * "Barcelona" and "Barbara" don't trip the bar rule. Kept narrow on purpose —
 * a false positive here caps a good plan's score.
 */
const NIGHTLIFE_MARKERS = [
  'bar',
  'bars',
  'pub',
  'izakaya',
  'cocktail',
  'cocktails',
  'nightclub',
  'nightlife',
  'speakeasy',
  'honky-tonk',
  'tavern',
  'brewery',
  'lounge',
];

/** Precompiled once — this is matched per item per day. */
const NIGHTLIFE_PATTERNS = NIGHTLIFE_MARKERS.map((m) => new RegExp(`\\b${m}\\b`));

type Located = { name: string; coordinates?: LatLng };

function isLocated(c?: LatLng): c is LatLng {
  return !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

/** name → coordinates for everything the research pass actually resolved. */
function buildCoordIndex(research: ResearchResult): Map<string, LatLng> {
  const index = new Map<string, LatLng>();
  const all: Located[] = [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ];
  for (const item of all) {
    const key = dedupeKey(item.name);
    if (key && isLocated(item.coordinates) && !index.has(key)) {
      index.set(key, item.coordinates);
    }
  }
  return index;
}

/** Every name the research pass offered, for off-pool detection. */
function buildPoolKeys(research: ResearchResult): Set<string> {
  const keys = new Set<string>();
  for (const item of [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]) {
    const key = dedupeKey(item.name);
    if (key) keys.add(key);
  }
  return keys;
}

function dayItems(day: ItineraryPlan['days'][number]): ScheduledItem[] {
  return [...(day.morning ?? []), ...(day.afternoon ?? []), ...(day.evening ?? [])];
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

function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

/**
 * Run every mechanical check over a plan.
 *
 * Geographic checks silently no-op when the research pool carries no
 * coordinates — they report on what they can see rather than inventing
 * confidence. (If they're always no-oping, Places resolution is off; see
 * tavily-service.)
 */
export function auditPlan(plan: ItineraryPlan, research: ResearchResult): PlanAudit {
  const findings: AuditFinding[] = [];
  const coords = buildCoordIndex(research);
  const poolKeys = buildPoolKeys(research);
  const days = plan.days ?? [];

  const locate = (item: ScheduledItem): LatLng | undefined =>
    coords.get(dedupeKey(item.name));

  // ── 1. The same venue twice in one trip ──────────────────────────────────
  const seen = new Map<string, number>();
  for (const day of days) {
    for (const item of dayItems(day)) {
      const key = dedupeKey(item.name);
      if (!key) continue;
      const firstDay = seen.get(key);
      if (firstDay !== undefined && firstDay !== day.dayNumber) {
        findings.push({
          severity: 'high',
          dayNumber: day.dayNumber,
          issue: `"${item.name}" is already on day ${firstDay}. The trip books the same place twice.`,
          suggestion: `Replace "${item.name}" on day ${day.dayNumber} with an unused option from the research pool.`,
          scoreCeiling: 70,
        });
      } else if (firstDay === undefined) {
        seen.set(key, day.dayNumber);
      }
    }
  }

  // ── 2. Geography ─────────────────────────────────────────────────────────
  let maxDaySpreadKm = 0;
  const allPoints: LatLng[] = [];
  for (const day of days) {
    const points = dayItems(day).map(locate).filter(isLocated);
    allPoints.push(...points);
    if (points.length < 2) continue;

    let spread = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        spread = Math.max(spread, haversineKm(points[i], points[j]));
      }
    }
    maxDaySpreadKm = Math.max(maxDaySpreadKm, spread);

    if (spread >= DAY_SPREAD_FAIL_KM) {
      findings.push({
        severity: 'high',
        dayNumber: day.dayNumber,
        issue: `Day ${day.dayNumber} spans ${spread.toFixed(1)}km end to end — it crosses the whole city.`,
        suggestion: `Rebuild day ${day.dayNumber} around a single neighbourhood and move the outliers to a day that is already near them.`,
        scoreCeiling: 65,
      });
    } else if (spread >= DAY_SPREAD_WARN_KM) {
      findings.push({
        severity: 'medium',
        dayNumber: day.dayNumber,
        issue: `Day ${day.dayNumber} spans ${spread.toFixed(1)}km — more travel than a coherent day should need.`,
        suggestion: `Tighten day ${day.dayNumber} so consecutive stops stay within a short hop of each other.`,
        scoreCeiling: 80,
      });
    }
  }

  // Anything far outside the trip's own centre of mass isn't in this city.
  const tripCentre = centroid(allPoints);
  if (tripCentre) {
    for (const day of days) {
      for (const item of dayItems(day)) {
        const point = locate(item);
        if (!isLocated(point)) continue;
        const distance = haversineKm(tripCentre, point);
        if (distance >= OUT_OF_REGION_KM) {
          findings.push({
            severity: 'high',
            dayNumber: day.dayNumber,
            issue: `"${item.name}" is ${distance.toFixed(0)}km from everything else on this trip — it is effectively a separate day trip.`,
            suggestion: `Drop "${item.name}" unless the whole day is built around it.`,
            scoreCeiling: 70,
          });
        }
      }
    }
  }

  // ── 3. Meals and empty buckets ───────────────────────────────────────────
  for (const day of days) {
    for (const bucket of ['morning', 'afternoon', 'evening'] as const) {
      if ((day[bucket] ?? []).length === 0) {
        findings.push({
          severity: 'medium',
          dayNumber: day.dayNumber,
          issue: `Day ${day.dayNumber} has nothing scheduled for the ${bucket}.`,
          suggestion: `Add at least one ${bucket} item to day ${day.dayNumber}.`,
          scoreCeiling: 80,
        });
      }
    }
    const hasDinner = (day.evening ?? []).some((i) => i.type === 'restaurant');
    if (!hasDinner && (day.evening ?? []).length > 0) {
      findings.push({
        severity: 'medium',
        dayNumber: day.dayNumber,
        issue: `Day ${day.dayNumber} has no dinner.`,
        suggestion: `Add an evening restaurant to day ${day.dayNumber}, near its last activity.`,
        scoreCeiling: 85,
      });
    }
  }

  // ── 4. Times that run backwards ──────────────────────────────────────────
  for (const day of days) {
    const times = dayItems(day)
      .map((i) => ({ name: i.name, at: toMinutes(i.time) }))
      .filter((t): t is { name: string; at: number } => t.at !== null);
    for (let i = 1; i < times.length; i++) {
      if (times[i].at < times[i - 1].at) {
        findings.push({
          severity: 'medium',
          dayNumber: day.dayNumber,
          issue: `Day ${day.dayNumber} runs backwards in time: "${times[i].name}" is scheduled before "${times[i - 1].name}".`,
          suggestion: `Re-sort day ${day.dayNumber} chronologically.`,
          scoreCeiling: 85,
        });
        break;
      }
    }
  }

  // ── 5. Things scheduled when they are shut ───────────────────────────────
  // A name heuristic, not real hours: a live run put "Bar Trench" at 09:00 and
  // "MOSS Dining Bar" at 11:00 on the same morning. Real grounding needs
  // opening_hours from Places Details (one extra lookup per candidate); until
  // then this catches the obvious class of error without that spend.
  for (const day of days) {
    for (const item of dayItems(day)) {
      const at = toMinutes(item.time);
      if (at === null || at >= 11 * 60) continue;
      // Name only. Folding the description in defeated the "kept narrow"
      // intent above: "grab breakfast at a sushi bar counter" and "hotel
      // lounge breakfast" both matched and capped a perfectly good plan.
      const text = item.name.toLowerCase();
      if (NIGHTLIFE_PATTERNS.some((p) => p.test(text))) {
        findings.push({
          severity: 'medium',
          dayNumber: day.dayNumber,
          issue: `"${item.name}" is scheduled at ${item.time} — a bar or nightlife venue that is almost certainly shut in the morning.`,
          suggestion: `Move "${item.name}" to the evening on day ${day.dayNumber} and put a morning-appropriate stop in its place.`,
          scoreCeiling: 85,
        });
      }
    }
  }

  // ── 6. Invented places ───────────────────────────────────────────────────
  const allItems = days.flatMap(dayItems);
  const offPool = poolKeys.size
    ? allItems.filter((i) => !poolKeys.has(dedupeKey(i.name)))
    : [];
  if (allItems.length > 0 && offPool.length / allItems.length > OFF_POOL_WARN_RATIO) {
    findings.push({
      severity: 'medium',
      issue: `${offPool.length} of ${allItems.length} items are not from the research pool (${offPool
        .slice(0, 5)
        .map((i) => `"${i.name}"`)
        .join(', ')}) — these are model recall, not verified places.`,
      suggestion:
        'Replace the untraceable items with candidates from the research pool, which are real and have provenance.',
      scoreCeiling: 80,
    });
  }

  const scoreCeiling = findings.reduce((min, f) => Math.min(min, f.scoreCeiling), 100);

  const summary =
    findings.length === 0
      ? 'Automated checks found no duplicates, geography, meal, ordering, or provenance problems.'
      : findings
          .map(
            (f) =>
              `- [${f.severity}]${f.dayNumber !== undefined ? ` Day ${f.dayNumber}:` : ''} ${f.issue}`
          )
          .join('\n');

  return {
    findings,
    scoreCeiling,
    summary,
    stats: {
      totalItems: allItems.length,
      offPoolItems: offPool.length,
      maxDaySpreadKm: Number(maxDaySpreadKm.toFixed(1)),
    },
  };
}
