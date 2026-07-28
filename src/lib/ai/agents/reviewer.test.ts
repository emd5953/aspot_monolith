import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ItineraryPlan, ResearchResult, ScheduledItem } from './types';
import { dedupeKey } from '../provenance';

/**
 * The score clamp is the load-bearing line of the whole audit change: the
 * model's score is overruled by `auditPlan`'s ceiling. Without a test, swapping
 * `Math.min` for `Math.max` — or merging the audit findings after `highIssues`
 * is counted — restores the exact bug the audit exists to prevent (92/100 for a
 * plan that books one venue twice) with every other test still green.
 *
 * `generateObject` is mocked so these run with no model call. It is the only
 * mocked seam; everything else is the real reviewer and the real audit.
 */

const generateObject = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateObject }));
vi.mock('@ai-sdk/openai', () => ({ openai: () => 'mock-model' }));

const { runReviewerAgent, plannedVenueKeys } = await import('./reviewer');

const item = (name: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  time: '10:00',
  name,
  type: 'attraction',
  duration: 90,
  ...over,
});

/** Two clean days, no mechanical faults for the audit to find. */
function cleanPlan(): ItineraryPlan {
  return {
    destination: 'Testville',
    summary: 'test',
    totalEstimatedCost: '$$',
    days: [1, 2].map((n) => ({
      dayNumber: n,
      date: `2026-09-0${n}`,
      theme: 'day',
      morning: [item(`Museum ${n}`)],
      // Lunch and dinner are part of a day's shape, so a "clean" plan needs
      // both — without them the audit rightly caps the score.
      afternoon: [
        item(`Park ${n}`),
        item(`Trattoria ${n}`, { type: 'restaurant', time: '13:00' }),
      ],
      evening: [item(`Osteria ${n}`, { type: 'restaurant', time: '19:00' })],
      notes: '',
      estimatedCost: '$$',
    })),
  };
}

/** The Nashville failure: the same venue on two consecutive days. */
function duplicateVenuePlan(): ItineraryPlan {
  const plan = cleanPlan();
  plan.days[1].morning = [item('The Bluebird Cafe')];
  plan.days[0].morning = [item('Bluebird Cafe')];
  return plan;
}

function research(names: string[]): ResearchResult {
  return {
    destination: 'Testville',
    attractions: names.map((name) => ({
      name,
      description: '',
      category: 'x',
      estimatedDuration: 90,
      priceRange: '$$',
    })),
    restaurants: [],
    activities: [],
    localInsights: [],
    sources: [],
  };
}

const preferences = {
  activityTypes: ['culture'],
  budgetRange: 'mid',
  travelPace: 'moderate',
} as never;

const req = (plan: ItineraryPlan) => ({
  plan,
  preferences,
  research: research(
    plan.days.flatMap((d) => [...d.morning, ...d.afternoon, ...d.evening]).map((i) => i.name)
  ),
});

function modelReturns(over: Record<string, unknown> = {}) {
  generateObject.mockResolvedValue({
    object: { approved: true, score: 92, issues: [], suggestions: [], ...over },
  });
}

beforeEach(() => {
  generateObject.mockReset();
});

describe('runReviewerAgent score ceiling', () => {
  it('caps a generous model score at the audit ceiling', async () => {
    modelReturns({ score: 92, approved: true });
    const { review } = await runReviewerAgent(req(duplicateVenuePlan()));

    // A cross-day duplicate is a hard 70 in plan-audit.
    expect(review.score).toBe(70);
  });

  it('leaves the model score alone when the audit is clean', async () => {
    modelReturns({ score: 88 });
    const { review } = await runReviewerAgent(req(cleanPlan()));

    expect(review.score).toBe(88);
    expect(review.approved).toBe(true);
  });

  it('refuses approval over an audit high finding even when the model approves', async () => {
    modelReturns({ score: 100, approved: true });
    const { review } = await runReviewerAgent(req(duplicateVenuePlan()));

    expect(review.approved).toBe(false);
  });

  it('puts audit findings ahead of the model’s own issues', async () => {
    modelReturns({
      score: 92,
      issues: [
        { severity: 'low', issue: 'model issue', suggestion: 'model suggestion' },
      ],
    });
    const { review } = await runReviewerAgent(req(duplicateVenuePlan()));

    expect(review.issues[0].severity).toBe('high');
    expect(review.issues[0].issue).toContain('Bluebird');
    expect(review.issues.at(-1)?.issue).toBe('model issue');
  });

  it('normalizes an off-enum severity from the model instead of throwing', async () => {
    modelReturns({
      issues: [{ severity: 'critical', issue: 'x', suggestion: 'y' }],
    });
    const { review } = await runReviewerAgent(req(cleanPlan()));

    expect(review.issues[0].severity).toBe('high');
    // A high issue, wherever it came from, blocks approval.
    expect(review.approved).toBe(false);
  });

  it.each([
    [120, 100],
    [-5, 0],
  ])('clamps an out-of-range model score of %i to %i', async (raw, expected) => {
    modelReturns({ score: raw });
    const { review } = await runReviewerAgent(req(cleanPlan()));
    expect(review.score).toBe(expected);
  });

  // Reviewing must never cost a second model call. Revisions belong to the
  // orchestrator, which is the only place the dedup and coverage guards run.
  it('never makes a second model call to revise a rejected plan', async () => {
    modelReturns({ score: 20, approved: false });
    const { review } = await runReviewerAgent(req(duplicateVenuePlan()));

    expect(review.approved).toBe(false);
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
});

/**
 * The "options not used" block used to compare names with raw `includes`,
 * against the AGENTS.md contract that all name comparison here goes through
 * `dedupeKey`. It failed both ways: a booked venue was offered back to the
 * reviewer as available (whose suggested swap then tripped the duplicate
 * finding), and a short pool name hid every real alternative containing it.
 */
describe('plannedVenueKeys', () => {
  it('canonicalizes names so an article does not read as a different venue', () => {
    const keys = plannedVenueKeys(duplicateVenuePlan());
    expect(keys.has(dedupeKey('The Bluebird Cafe'))).toBe(true);
    expect(keys.has(dedupeKey('Bluebird Cafe'))).toBe(true);
  });

  it('collects across every bucket and day', () => {
    const keys = plannedVenueKeys(cleanPlan());
    for (const name of ['Museum 1', 'Park 1', 'Osteria 1', 'Museum 2', 'Osteria 2']) {
      expect(keys.has(dedupeKey(name))).toBe(true);
    }
  });

  it('does not treat a substring match as the same venue', () => {
    // The plan books "Park 1" and "Park 2"; a pool entry simply named "Park"
    // is a different place and must stay offerable as an alternative.
    const keys = plannedVenueKeys(cleanPlan());
    expect(keys.has(dedupeKey('Park'))).toBe(false);
  });
});
