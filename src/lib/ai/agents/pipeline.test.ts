import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchResult } from './types';
import type { UserPreferences } from '@/types/profile';

/**
 * The pipeline with the model seam mocked. What is asserted here is everything
 * the pipeline does *around* the LLM call — which is where the product's
 * guarantees live:
 *
 *  - the real published time is stamped by us, from the pool, not by the model
 *  - a place the model invented gets no time and is marked as model recall
 *  - the list is ordered by when events actually start
 */

const generateObject = vi.fn();
vi.mock('ai', () => ({ generateObject: (...args: unknown[]) => generateObject(...args) }));
vi.mock('@ai-sdk/openai', () => ({ openai: (m: string) => m }));

const { runPipeline } = await import('./pipeline');

const preferences = { activityTypes: [] } as unknown as UserPreferences;

const research: ResearchResult = {
  destination: 'New York City',
  attractions: [],
  restaurants: [
    {
      name: 'Late Dinner Spot',
      cuisine: ['italian'],
      priceRange: '$$',
    },
  ],
  activities: [
    {
      name: 'Warehouse Set',
      description: 'house all night',
      category: 'event',
      duration: 300,
      adventureLevel: 5,
      priceRange: '$$',
      startsAt: '2026-09-12T23:00:00-04:00',
      endsAt: '2026-09-13T04:00:00-04:00',
    },
    {
      name: 'Rooftop Opener',
      description: 'early drinks',
      category: 'event',
      duration: 120,
      adventureLevel: 4,
      priceRange: '$',
      startsAt: '2026-09-12T20:00:00-04:00',
    },
  ],
  localInsights: [],
  sources: [],
};

const modelReturns = (plans: Array<{ name: string; type?: string }>) => {
  generateObject.mockResolvedValueOnce({
    object: {
      summary: 'a night',
      plans: plans.map((p) => ({ name: p.name, type: p.type ?? 'activity' })),
      totalEstimatedCost: 'Varies',
      importantNotes: [],
    },
  });
};

beforeEach(() => generateObject.mockReset());

describe('runPipeline', () => {
  it('stamps the real published time onto each pick', async () => {
    modelReturns([{ name: 'Warehouse Set' }]);
    const out = await runPipeline({ research, preferences });
    expect(out.success).toBe(true);
    expect(out.plan!.plans![0].startsAt).toBe('2026-09-12T23:00:00-04:00');
    expect(out.plan!.plans![0].endsAt).toBe('2026-09-13T04:00:00-04:00');
  });

  it('orders picks by when they actually start, not by model rank', async () => {
    // Model returns the late event first; the real times must reorder it.
    modelReturns([{ name: 'Warehouse Set' }, { name: 'Rooftop Opener' }]);
    const out = await runPipeline({ research, preferences });
    expect(out.plan!.plans!.map((p) => p.name)).toEqual([
      'Rooftop Opener',
      'Warehouse Set',
    ]);
  });

  it('leaves untimed picks without a time, sorted last', async () => {
    modelReturns([{ name: 'Late Dinner Spot', type: 'restaurant' }, { name: 'Rooftop Opener' }]);
    const out = await runPipeline({ research, preferences });
    const [first, second] = out.plan!.plans!;
    expect(first.name).toBe('Rooftop Opener');
    expect(second.name).toBe('Late Dinner Spot');
    expect(second.startsAt).toBeUndefined();
  });

  it('gives an invented place no time and marks it model recall', async () => {
    modelReturns([{ name: 'Somewhere That Does Not Exist' }]);
    const out = await runPipeline({ research, preferences });
    const pick = out.plan!.plans![0];
    // We never fabricate a time for something we cannot trace to the pool.
    expect(pick.startsAt).toBeUndefined();
    expect(pick.source).toBe('ai');
    expect(out.check!.stats.offPoolItems).toBe(1);
  });

  it('drops a venue the model listed twice', async () => {
    modelReturns([{ name: 'Warehouse Set' }, { name: 'Warehouse Set' }]);
    const out = await runPipeline({ research, preferences });
    expect(out.plan!.plans).toHaveLength(1);
  });

  it('never asks the model for a time', async () => {
    modelReturns([{ name: 'Warehouse Set' }]);
    await runPipeline({ research, preferences });
    const prompt = generateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('Do NOT decide what time anything happens');
  });

  it('shows the model the real times it has to work with', async () => {
    modelReturns([{ name: 'Warehouse Set' }]);
    await runPipeline({ research, preferences });
    const prompt = generateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('starts 11:00 PM');
  });

  it('fails cleanly when the pool is empty', async () => {
    const empty: ResearchResult = { ...research, attractions: [], restaurants: [], activities: [] };
    const out = await runPipeline({ research: empty, preferences });
    expect(out.success).toBe(false);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('reports a model failure instead of throwing', async () => {
    generateObject.mockRejectedValueOnce(new Error('model unavailable'));
    const out = await runPipeline({ research, preferences });
    expect(out.success).toBe(false);
    expect(out.error).toBe('model unavailable');
  });
});
