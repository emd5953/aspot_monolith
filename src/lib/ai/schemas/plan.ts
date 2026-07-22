/**
 * Schemas for planner agent outputs.
 *
 * These Zod schemas are the **contract** between the LLM and the rest of the
 * pipeline. Used with `generateObject` from the ai SDK so the model physically
 * cannot return a wrong shape — no more regex-extract + try/catch + fallback.
 *
 * The schemas mirror the runtime types in `src/lib/ai/agents/types.ts`
 * (`ItineraryPlan`, `DayPlan`, `ScheduledItem`) and the structures the
 * planners were already trying to emit by hand.
 *
 * Keep these schemas conservative on what's required. The planner LLM does
 * better with a schema where most leaf fields are optional and post-processing
 * supplies sane defaults than with a strict-everything schema where one
 * missing field tanks the whole response.
 */

import { z } from 'zod';

// ─── Item type normalization ────────────────────────────────────────────────

/**
 * The five slot kinds the rest of the pipeline understands.
 *
 * These are NOT enforced as a Zod enum on the wire. We send
 * `strictJsonSchema: false` to OpenAI (the schema has optional fields), which
 * means the provider does *not* constrain the response — so a model that
 * decides an item is `"entertainment"` used to throw a ZodError, reject the
 * day-build promise, and take the entire generation down with it. The wire
 * schema accepts any string; `normalizeItemType` maps it onto the enum.
 */
export const ITEM_TYPES = [
  'attraction',
  'restaurant',
  'activity',
  'transport',
  'free_time',
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** Off-enum values models actually emit, mapped to the closest real slot. */
const ITEM_TYPE_ALIASES: Record<string, ItemType> = {
  entertainment: 'activity',
  nightlife: 'activity',
  event: 'activity',
  show: 'activity',
  tour: 'activity',
  experience: 'activity',
  shopping: 'activity',
  outdoor: 'activity',
  bar: 'restaurant',
  cafe: 'restaurant',
  coffee: 'restaurant',
  food: 'restaurant',
  dining: 'restaurant',
  meal: 'restaurant',
  breakfast: 'restaurant',
  lunch: 'restaurant',
  dinner: 'restaurant',
  drinks: 'restaurant',
  museum: 'attraction',
  landmark: 'attraction',
  sightseeing: 'attraction',
  park: 'attraction',
  neighborhood: 'attraction',
  travel: 'transport',
  transit: 'transport',
  commute: 'transport',
  rest: 'free_time',
  break: 'free_time',
  free: 'free_time',
  relax: 'free_time',
};

/**
 * Coerce whatever the model called this slot into a real `ItemType`.
 * Unknown values fall back to `activity` — the most neutral slot — rather than
 * failing, because a slightly mistyped item is infinitely better than a dead
 * generation.
 */
export function normalizeItemType(raw: unknown): ItemType {
  if (typeof raw !== 'string') return 'activity';
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if ((ITEM_TYPES as readonly string[]).includes(key)) return key as ItemType;
  return ITEM_TYPE_ALIASES[key] ?? 'activity';
}

/** Clamp a model-supplied duration into the range the UI can render. */
export function normalizeDuration(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 90;
  return Math.min(Math.max(Math.round(n), 15), 360);
}

/** Coerce a model-supplied issue severity; anything unrecognized is `medium`. */
export function normalizeSeverity(raw: unknown): 'low' | 'medium' | 'high' {
  const key = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (key === 'low' || key === 'high') return key;
  if (key === 'critical' || key === 'severe' || key === 'blocker') return 'high';
  if (key === 'minor' || key === 'nit') return 'low';
  return 'medium';
}

// ─── Per-item shapes ────────────────────────────────────────────────────────

/**
 * One scheduled thing in a day (an activity, restaurant stop, etc.).
 * Mirrors `ScheduledItem` in agents/types.ts but loosened in places where the
 * model often omits values that we can fill in ourselves.
 *
 * Deliberately free of value constraints (no enum, no min/max). Because we run
 * with `strictJsonSchema: false`, OpenAI does not enforce the schema — every
 * constraint here is a *client-side throw waiting to happen*, and a throw in a
 * parallel day build kills the whole itinerary. Constraints are expressed as
 * descriptions (which steer the model) and enforced by the `normalize*`
 * helpers above (which cannot fail).
 */
export const ScheduledItemSchema = z.object({
  /** "HH:MM" 24h. Falls back to "10:00" downstream if missing. */
  time: z.string().describe('24-hour HH:MM start time, e.g. "09:00".'),
  name: z
    .string()
    .describe(
      "The real, specific name of the place or activity. e.g. 'The Dead Rabbit', not 'a bar'."
    ),
  type: z
    .string()
    .describe(
      'Exactly one of: attraction | restaurant | activity | transport | free_time. Use "restaurant" for any meal or drinks stop, "activity" for tours, shows and nightlife.'
    ),
  /** Minutes. Clamped to 15-360 by `normalizeDuration`. */
  duration: z.number().describe('Duration in minutes (15-360).'),
  description: z
    .string()
    .optional()
    .describe('1-2 sentences of why this fits the trip.'),
  tips: z.string().optional(),
  /** Reviewer/UI uses this; planner gets bonus signal by emitting it. */
  matchScore: z.number().optional().describe('0-100 fit score for this user.'),
  matchReasons: z
    .array(z.string())
    .optional()
    .describe('Short bullet reasons this item fits the user.'),
  /**
   * Provenance, stamped post-planning by the orchestrator (not the LLM) by
   * matching the name back to the research pool. Optional in the schema so the
   * planner needn't emit it; included so the field survives any schema-validated
   * round-trip of a plan.
   */
  source: z
    .string()
    .optional()
    .describe('Set by the pipeline, not the model. Ignore.'),
});

/**
 * One full day in the itinerary. Mirrors `DayPlan` in agents/types.ts.
 *
 * The buckets (morning/afternoon/evening) are required arrays so the model
 * can't return "[]" as a sneaky empty day. Empty arrays are technically valid
 * here but post-processing flags days that have zero items across all three.
 */
export const DayPlanSchema = z.object({
  /** Overwritten by the orchestrator, so unconstrained on the wire. */
  dayNumber: z.number(),
  /** YYYY-MM-DD. Post-processing will overwrite with the correct calendar
   *  date computed from startDate + index, so the model can leave it best-effort. */
  date: z
    .string()
    .describe(
      'YYYY-MM-DD. The orchestrator overwrites this with the correct calendar date.'
    ),
  theme: z
    .string()
    .optional()
    .describe('A short label for the day, e.g. "Arrival & Lower East Side".'),
  morning: z.array(ScheduledItemSchema).default([]),
  afternoon: z.array(ScheduledItemSchema).default([]),
  evening: z.array(ScheduledItemSchema).default([]),
  notes: z.string().optional().default(''),
  estimatedCost: z
    .string()
    .optional()
    .default('Varies')
    .describe('Free text like "$80-120".'),
});

// ─── Plan-level shapes ──────────────────────────────────────────────────────

/**
 * Full itinerary plan. Mirrors `ItineraryPlan` in agents/types.ts.
 * `destination` is set by the orchestrator post-hoc — the planner doesn't
 * need to repeat it back.
 */
export const ItineraryPlanSchema = z.object({
  summary: z
    .string()
    .describe(
      'One sentence describing the overall vibe/arc of the trip. Should reference the user\'s focus.'
    ),
  days: z
    .array(DayPlanSchema)
    .min(1)
    .describe('One entry per trip day, in order.'),
  totalEstimatedCost: z.string().optional().default('Varies'),
  packingTips: z.array(z.string()).optional().default([]),
  importantNotes: z.array(z.string()).optional().default([]),
});

export type ScheduledItemSchemaT = z.infer<typeof ScheduledItemSchema>;
export type DayPlanSchemaT = z.infer<typeof DayPlanSchema>;
export type ItineraryPlanSchemaT = z.infer<typeof ItineraryPlanSchema>;

// ─── Strategy schema (used by agentic-planner first pass) ───────────────────

/**
 * The high-level "approach" the agentic planner produces before building
 * each day. Used internally; never persisted.
 */
export const PlanningStrategySchema = z.object({
  approach: z.string().describe('Overall strategic approach in one sentence.'),
  reasoning: z
    .string()
    .describe('Why this approach fits this traveler and this prompt.'),
  dayThemes: z
    .array(z.string())
    .min(1)
    .describe(
      'One theme per trip day, in order. Each theme should clearly serve the user focus when present.'
    ),
  pacingStrategy: z.string(),
  mealStrategy: z.string(),
});

export type PlanningStrategySchemaT = z.infer<typeof PlanningStrategySchema>;

// ─── Single-day schema (used by agentic-planner per-day pass) ───────────────

/**
 * What the per-day builder returns. Looser than DayPlanSchema because the
 * orchestrator stamps dayNumber/date afterward and computes some fields.
 */
export const SingleDaySchema = z.object({
  areaFocus: z
    .string()
    .optional()
    .describe(
      'The neighborhood/district anchoring this day — used for proximity grouping.'
    ),
  morning: z.array(ScheduledItemSchema).default([]),
  afternoon: z.array(ScheduledItemSchema).default([]),
  evening: z.array(ScheduledItemSchema).default([]),
  reasoning: z
    .array(z.string())
    .optional()
    .default([])
    .describe(
      'Short bullets explaining why this day works as a coherent unit and why it serves the user focus.'
    ),
  theme: z.string().optional(),
});

export type SingleDaySchemaT = z.infer<typeof SingleDaySchema>;

// ─── Reviewer schema ────────────────────────────────────────────────────────

/**
 * One issue the reviewer found. Mirrors `ReviewIssue` in agents/types.ts.
 */
export const ReviewIssueSchema = z.object({
  severity: z
    .string()
    .describe('Exactly one of: low | medium | high.'),
  dayNumber: z.number().optional(),
  issue: z.string().describe('What is wrong.'),
  suggestion: z.string().describe('How to fix it.'),
});

/**
 * Reviewer output. Drives the orchestrator's approve/iterate decision.
 * `approved` and `score` are the load-bearing fields.
 */
export const ReviewSchema = z.object({
  approved: z.boolean().describe('Whether the plan is good enough to ship.'),
  /** Clamped to 0-100 by the reviewer; unconstrained here so an out-of-range
   *  score can't throw and take the orchestrator down. */
  score: z.number().describe('Overall quality, 0-100.'),
  issues: z.array(ReviewIssueSchema).default([]),
  suggestions: z
    .array(z.string())
    .default([])
    .describe('General improvement ideas not tied to a single day.'),
  reasoning: z.string().optional().describe('One-paragraph overall assessment.'),
});

export type ReviewSchemaT = z.infer<typeof ReviewSchema>;
