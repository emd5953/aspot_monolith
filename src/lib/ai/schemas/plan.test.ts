import { describe, it, expect } from 'vitest';
import {
  ScheduledItemSchema,
  DayPlanSchema,
  ItineraryPlanSchema,
  SingleDaySchema,
  PlanningStrategySchema,
  ReviewSchema,
} from './plan';

/**
 * These schemas are the LLM↔pipeline contract enforced by `generateObject`.
 * The tests here lock in two things the migration depends on:
 *   1. Defaults fill in fields the model is allowed to omit.
 *   2. Genuinely malformed shapes are rejected (not silently coerced),
 *      so a bad model response surfaces as a parse error rather than a
 *      half-built itinerary downstream.
 */

const validItem = {
  time: '09:00',
  name: 'The Dead Rabbit',
  type: 'restaurant' as const,
  duration: 90,
};

describe('ScheduledItemSchema', () => {
  it('accepts a minimal valid item', () => {
    expect(ScheduledItemSchema.parse(validItem)).toMatchObject(validItem);
  });

  it('rejects a placeholder/too-short name', () => {
    expect(ScheduledItemSchema.safeParse({ ...validItem, name: 'a' }).success).toBe(
      false
    );
  });

  it('rejects an unknown slot type', () => {
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, type: 'museum' }).success
    ).toBe(false);
  });

  it('clamps nothing but rejects out-of-range duration', () => {
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, duration: 5 }).success
    ).toBe(false);
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, duration: 1000 }).success
    ).toBe(false);
  });

  it('rejects a matchScore outside 0-100', () => {
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, matchScore: 140 }).success
    ).toBe(false);
  });

  it('keeps optional fields optional', () => {
    const parsed = ScheduledItemSchema.parse(validItem);
    expect(parsed.description).toBeUndefined();
    expect(parsed.matchReasons).toBeUndefined();
  });
});

describe('DayPlanSchema', () => {
  it('fills the three time buckets and metadata defaults when omitted', () => {
    const parsed = DayPlanSchema.parse({ dayNumber: 1, date: '2026-06-12' });
    expect(parsed.morning).toEqual([]);
    expect(parsed.afternoon).toEqual([]);
    expect(parsed.evening).toEqual([]);
    expect(parsed.notes).toBe('');
    expect(parsed.estimatedCost).toBe('Varies');
  });

  it('allows a structurally-empty day (post-processing flags it, schema does not)', () => {
    // Documents intent: zero items across all buckets is valid here on purpose.
    const res = DayPlanSchema.safeParse({ dayNumber: 1, date: '2026-06-12' });
    expect(res.success).toBe(true);
  });

  it('rejects dayNumber < 1', () => {
    expect(
      DayPlanSchema.safeParse({ dayNumber: 0, date: '2026-06-12' }).success
    ).toBe(false);
  });

  it('rejects a malformed item inside a bucket', () => {
    const res = DayPlanSchema.safeParse({
      dayNumber: 1,
      date: '2026-06-12',
      morning: [{ ...validItem, type: 'nope' }],
    });
    expect(res.success).toBe(false);
  });
});

describe('ItineraryPlanSchema', () => {
  const validPlan = {
    summary: 'A jazz-forward long weekend in NOLA.',
    days: [{ dayNumber: 1, date: '2026-06-12', morning: [validItem] }],
  };

  it('parses a valid plan and applies plan-level defaults', () => {
    const parsed = ItineraryPlanSchema.parse(validPlan);
    expect(parsed.totalEstimatedCost).toBe('Varies');
    expect(parsed.packingTips).toEqual([]);
    expect(parsed.importantNotes).toEqual([]);
  });

  it('requires at least one day', () => {
    expect(
      ItineraryPlanSchema.safeParse({ ...validPlan, days: [] }).success
    ).toBe(false);
  });

  it('requires a summary', () => {
    const { summary, ...noSummary } = validPlan;
    void summary;
    expect(ItineraryPlanSchema.safeParse(noSummary).success).toBe(false);
  });
});

describe('SingleDaySchema', () => {
  it('defaults buckets and reasoning so the orchestrator can stamp the rest', () => {
    const parsed = SingleDaySchema.parse({});
    expect(parsed.morning).toEqual([]);
    expect(parsed.afternoon).toEqual([]);
    expect(parsed.evening).toEqual([]);
    expect(parsed.reasoning).toEqual([]);
  });
});

describe('PlanningStrategySchema', () => {
  it('requires at least one day theme', () => {
    const base = {
      approach: 'Anchor each day in one walkable district.',
      reasoning: 'Minimizes transit for a relaxed pace.',
      pacingStrategy: 'Two anchors per day.',
      mealStrategy: 'One standout dinner nightly.',
    };
    expect(strategyParses(base, { dayThemes: ['Arrival'] })).toBe(true);
    expect(strategyParses(base, { dayThemes: [] })).toBe(false);
  });
});

// Small helper to keep PlanningStrategy cases readable.
function strategyParses(
  base: Record<string, unknown>,
  extra: Record<string, unknown>
) {
  return PlanningStrategySchema.safeParse({ ...base, ...extra }).success;
}

describe('ReviewSchema', () => {
  it('parses a minimal approved review and defaults the lists', () => {
    const parsed = ReviewSchema.parse({ approved: true, score: 88 });
    expect(parsed.issues).toEqual([]);
    expect(parsed.suggestions).toEqual([]);
  });

  it('rejects a score outside 0-100 (load-bearing for the iterate decision)', () => {
    expect(ReviewSchema.safeParse({ approved: true, score: 101 }).success).toBe(
      false
    );
    expect(ReviewSchema.safeParse({ approved: false, score: -1 }).success).toBe(
      false
    );
  });

  it('rejects a bad issue severity', () => {
    const res = ReviewSchema.safeParse({
      approved: false,
      score: 50,
      issues: [{ severity: 'critical', issue: 'x', suggestion: 'y' }],
    });
    expect(res.success).toBe(false);
  });
});
