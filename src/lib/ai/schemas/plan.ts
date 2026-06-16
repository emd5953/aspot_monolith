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

// ─── Per-item shapes ────────────────────────────────────────────────────────

/**
 * One scheduled thing in a day (an activity, restaurant stop, etc.).
 * Mirrors `ScheduledItem` in agents/types.ts but loosened in places where the
 * model often omits values that we can fill in ourselves.
 */
export const ScheduledItemSchema = z.object({
  /** "HH:MM" 24h. Falls back to "10:00" downstream if missing. */
  time: z.string().describe('24-hour HH:MM start time, e.g. "09:00".'),
  name: z
    .string()
    .min(2)
    .describe(
      "The real, specific name of the place or activity. e.g. 'The Dead Rabbit', not 'a bar'."
    ),
  type: z
    .enum(['attraction', 'restaurant', 'activity', 'transport', 'free_time'])
    .describe('What kind of slot this is. Use restaurant for any meal.'),
  /** Minutes. */
  duration: z
    .number()
    .int()
    .min(15)
    .max(360)
    .describe('Duration in minutes (15-360).'),
  description: z
    .string()
    .optional()
    .describe('1-2 sentences of why this fits the trip.'),
  tips: z.string().optional(),
  /** Reviewer/UI uses this; planner gets bonus signal by emitting it. */
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('0-100 fit score for this user.'),
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
  source: z.enum(['reddit', 'places', 'tavily', 'ai']).optional(),
});

/**
 * One full day in the itinerary. Mirrors `DayPlan` in agents/types.ts.
 *
 * The buckets (morning/afternoon/evening) are required arrays so the model
 * can't return "[]" as a sneaky empty day. Empty arrays are technically valid
 * here but post-processing flags days that have zero items across all three.
 */
export const DayPlanSchema = z.object({
  dayNumber: z.number().int().min(1),
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
  severity: z.enum(['low', 'medium', 'high']),
  dayNumber: z.number().int().optional(),
  issue: z.string().describe('What is wrong.'),
  suggestion: z.string().describe('How to fix it.'),
});

/**
 * Reviewer output. Drives the orchestrator's approve/iterate decision.
 * `approved` and `score` are the load-bearing fields.
 */
export const ReviewSchema = z.object({
  approved: z.boolean().describe('Whether the plan is good enough to ship.'),
  score: z.number().min(0).max(100).describe('Overall quality, 0-100.'),
  issues: z.array(ReviewIssueSchema).default([]),
  suggestions: z
    .array(z.string())
    .default([])
    .describe('General improvement ideas not tied to a single day.'),
  reasoning: z.string().optional().describe('One-paragraph overall assessment.'),
});

export type ReviewSchemaT = z.infer<typeof ReviewSchema>;
