import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ItineraryPlan, ResearchResult, ScheduledItem } from './types';
import type { UserPreferences } from '@/types/quiz';

/**
 * The load-bearing claim of the repair pass: it runs on the *fast* path.
 *
 * Fast mode is `maxIterations = 1`, so `decideNextAction` returns "stop" on the
 * first pass before any reasoning happens — the audit's score ceiling can cap a
 * flawed plan but nothing ever acts on it, and the reviewer's revision only
 * fires on an unapproved review with a high-severity issue. Before repair, a
 * plan with a backwards clock or an empty afternoon simply shipped with it.
 *
 * These tests drive the real orchestrator with every model seam mocked, and
 * assert on the plan the reviewer is *handed* — proving repair happened before
 * review, not merely somewhere.
 */

const runAgenticResearcher = vi.hoisted(() => vi.fn());
const runAgenticPlanner = vi.hoisted(() => vi.fn());
const runReviewerAgent = vi.hoisted(() => vi.fn());
const reviseItineraryPlan = vi.hoisted(() => vi.fn());

vi.mock('./agentic-researcher', () => ({ runAgenticResearcher }));
vi.mock('./reviewer', () => ({ runReviewerAgent, reviseItineraryPlan }));
vi.mock('../research-cache', () => ({
  getCachedResearch: () => null,
  setCachedResearch: () => undefined,
}));
vi.mock('./agentic-planner', async (importOriginal) => ({
  // Keep the real cross-day dedup — the orchestrator's revision path depends on
  // it and AGENTS.md requires every shipped plan to pass through it.
  ...(await importOriginal<typeof import('./agentic-planner')>()),
  runAgenticPlanner,
}));

const { runAgenticOrchestrator } = await import('./agentic-orchestrator');

const item = (name: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  time: '10:00',
  name,
  type: 'attraction',
  duration: 90,
  ...over,
});

const preferences = {
  activityTypes: [],
  cuisinePreferences: [],
  travelMotivations: [],
} as unknown as UserPreferences;

function research(extraNames: string[] = []): ResearchResult {
  return {
    destination: 'Testville',
    attractions: [
      ...['Museum', 'Gallery', ...extraNames].map((name) => ({
        name,
        description: '',
        category: 'x',
        estimatedDuration: 90,
        priceRange: '$$',
      })),
    ],
    restaurants: [
      {
        name: 'Osteria',
        cuisine: ['italian'],
        priceRange: '$$',
      },
    ],
    activities: [],
    localInsights: [],
    sources: [],
  };
}

/** One day, deliberately faulty: backwards morning and an empty afternoon. */
function faultyPlan(): ItineraryPlan {
  return {
    destination: 'Testville',
    summary: 'test',
    totalEstimatedCost: '$$',
    days: [
      {
        dayNumber: 1,
        date: '2026-09-10',
        theme: 'day',
        morning: [item('Later Stop', { time: '11:00' }), item('Earlier Stop', { time: '09:00' })],
        afternoon: [],
        evening: [item('Osteria', { type: 'restaurant', time: '19:00' })],
        notes: '',
        estimatedCost: '$$',
      },
    ],
  };
}

/** The plan the reviewer was actually handed. */
function reviewedPlan(): ItineraryPlan {
  return runReviewerAgent.mock.calls[0][0].plan;
}

beforeEach(() => {
  vi.clearAllMocks();

  runAgenticResearcher.mockResolvedValue({
    result: research(['Spare Attraction']),
    thoughts: [],
    reasoningSteps: [],
  });

  runAgenticPlanner.mockResolvedValue({
    plan: faultyPlan(),
    thoughts: [],
    reasoningSteps: [],
    pools: [
      {
        attractions: [
          {
            name: 'Spare Attraction',
            description: '',
            category: 'x',
            estimatedDuration: 90,
            priceRange: '$$',
          },
        ],
        restaurants: [],
        activities: [],
      },
    ],
  });

  runReviewerAgent.mockResolvedValue({
    review: { approved: true, score: 80, issues: [], suggestions: [] },
    thoughts: [],
  });
});

const run = () =>
  runAgenticOrchestrator({
    destination: 'Testville',
    startDate: new Date('2026-09-10T00:00:00Z'),
    endDate: new Date('2026-09-10T00:00:00Z'),
    preferences,
    qualityThreshold: 60,
    maxIterations: 1,
  });

describe('runAgenticOrchestrator — deterministic repair on the fast path', () => {
  it('repairs the plan before the reviewer ever sees it', async () => {
    await run();
    expect(reviewedPlan().days[0].morning.map((i) => i.name)).toEqual([
      'Earlier Stop',
      'Later Stop',
    ]);
  });

  it('refills the empty bucket from the day pool', async () => {
    await run();
    expect(reviewedPlan().days[0].afternoon.map((i) => i.name)).toEqual([
      'Spare Attraction',
    ]);
  });

  it('returns the repaired plan, not the planner output', async () => {
    const out = await run();
    expect(out.plan?.days[0].afternoon).toHaveLength(1);
    expect(out.plan?.days[0].morning[0].name).toBe('Earlier Stop');
  });

  // The whole point: one iteration, no revision, still improved.
  it('improves the plan without a revision call', async () => {
    await run();
    expect(reviseItineraryPlan).not.toHaveBeenCalled();
    expect(runAgenticPlanner).toHaveBeenCalledTimes(1);
  });

  it('records what it fixed in the reasoning trail', async () => {
    const out = await run();
    expect(out.thoughts.some((t) => t.includes('Deterministic repair applied'))).toBe(
      true
    );
  });
});
