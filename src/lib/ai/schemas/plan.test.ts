import { describe, it, expect } from 'vitest';
import {
  ScheduledItemSchema,
  DayPlanSchema,
  ItineraryPlanSchema,
  SingleDaySchema,
  PlanningStrategySchema,
  ReviewSchema,
  normalizeItemType,
  normalizeDuration,
  normalizeSeverity,
} from './plan';

/**
 * These schemas are the LLM↔pipeline contract enforced by `generateObject`.
 * The tests here lock in:
 *   1. Defaults fill in fields the model is allowed to omit.
 *   2. Structural violations (missing required fields, wrong JSON types) are
 *      still rejected.
 *   3. *Value* violations are NOT rejected — they are normalized.
 *
 * Point 3 is deliberate and hard-won. We call OpenAI with
 * `strictJsonSchema: false`, so the provider does not constrain the response;
 * every value constraint in the schema was a client-side throw waiting to
 * happen. A real generation died because a model labelled an item
 * `"entertainment"`: the enum threw, the day-build promise rejected, and
 * `Promise.all` took the entire itinerary down. A slightly mislabelled item is
 * always better than no trip, so the schema now carries shape and the
 * `normalize*` helpers carry values.
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

  it('still rejects structurally wrong values', () => {
    // Wrong JSON type is a real parse failure — normalization can't rescue it.
    expect(ScheduledItemSchema.safeParse({ ...validItem, name: 42 }).success).toBe(
      false
    );
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, duration: 'ninety' }).success
    ).toBe(false);
  });

  it('accepts off-enum values rather than throwing (they are normalized later)', () => {
    // This exact value killed a live generation before the schema was loosened.
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, type: 'entertainment' }).success
    ).toBe(true);
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, duration: 1000 }).success
    ).toBe(true);
    expect(
      ScheduledItemSchema.safeParse({ ...validItem, matchScore: 140 }).success
    ).toBe(true);
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

  it('tolerates an off-enum item type inside a bucket', () => {
    // One weird item must never invalidate the day that contains it.
    const res = DayPlanSchema.safeParse({
      dayNumber: 1,
      date: '2026-06-12',
      morning: [{ ...validItem, type: 'nope' }],
    });
    expect(res.success).toBe(true);
  });

  it('still rejects a structurally broken item inside a bucket', () => {
    const res = DayPlanSchema.safeParse({
      dayNumber: 1,
      date: '2026-06-12',
      morning: [{ time: '09:00' }], // no name, no type, no duration
    });
    expect(res.success).toBe(false);
  });
});

describe('normalizeItemType', () => {
  it('passes through the five real slot types', () => {
    for (const t of ['attraction', 'restaurant', 'activity', 'transport', 'free_time']) {
      expect(normalizeItemType(t)).toBe(t);
    }
  });

  it('maps the off-enum values models actually emit', () => {
    expect(normalizeItemType('entertainment')).toBe('activity');
    expect(normalizeItemType('nightlife')).toBe('activity');
    expect(normalizeItemType('bar')).toBe('restaurant');
    expect(normalizeItemType('Dinner')).toBe('restaurant');
    expect(normalizeItemType('museum')).toBe('attraction');
    expect(normalizeItemType('free time')).toBe('free_time');
  });

  it('falls back to activity for anything unrecognized or absent', () => {
    expect(normalizeItemType('zzz')).toBe('activity');
    expect(normalizeItemType(undefined)).toBe('activity');
    expect(normalizeItemType(7)).toBe('activity');
  });
});

describe('normalizeDuration', () => {
  it('clamps into the renderable range instead of failing', () => {
    expect(normalizeDuration(5)).toBe(15);
    expect(normalizeDuration(1000)).toBe(360);
    expect(normalizeDuration(90)).toBe(90);
  });

  it('defaults when the value is missing or not a number', () => {
    expect(normalizeDuration(undefined)).toBe(90);
    expect(normalizeDuration(NaN)).toBe(90);
  });
});

describe('normalizeSeverity', () => {
  it('passes through the three real severities', () => {
    expect(normalizeSeverity('low')).toBe('low');
    expect(normalizeSeverity('medium')).toBe('medium');
    expect(normalizeSeverity('high')).toBe('high');
  });

  it('maps common synonyms and defaults to medium', () => {
    expect(normalizeSeverity('critical')).toBe('high');
    expect(normalizeSeverity('nit')).toBe('low');
    expect(normalizeSeverity('whatever')).toBe('medium');
    expect(normalizeSeverity(undefined)).toBe('medium');
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

  it('accepts an out-of-range score (the reviewer clamps it)', () => {
    // Score is load-bearing for the iterate decision, which is exactly why a
    // weird value must be clamped rather than allowed to throw the orchestrator.
    expect(ReviewSchema.safeParse({ approved: true, score: 101 }).success).toBe(
      true
    );
    expect(ReviewSchema.safeParse({ approved: false, score: -1 }).success).toBe(
      true
    );
  });

  it('accepts a synonym issue severity (normalized by the reviewer)', () => {
    const res = ReviewSchema.safeParse({
      approved: false,
      score: 50,
      issues: [{ severity: 'critical', issue: 'x', suggestion: 'y' }],
    });
    expect(res.success).toBe(true);
    expect(normalizeSeverity(res.data!.issues[0].severity)).toBe('high');
  });
});
