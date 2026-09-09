import { describe, it, expect } from 'vitest';
import { canVoteOnPlan, getVoteCounts } from './share-service';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal supabase stub for the vote-tally read path. */
function stubSupabase(rows: { plan_id: string; user_id: string; vote: number }[]) {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('getVoteCounts', () => {
  it('tallies up/down per plan and flags the caller vote', async () => {
    const supabase = stubSupabase([
      { plan_id: 'p1', user_id: 'me', vote: 1 },
      { plan_id: 'p1', user_id: 'friend-a', vote: 1 },
      { plan_id: 'p1', user_id: 'friend-b', vote: -1 },
      { plan_id: 'p2', user_id: 'friend-a', vote: -1 },
    ]);

    const counts = await getVoteCounts(supabase, ['p1', 'p2', 'p3'], 'me');

    expect(counts).toEqual([
      { planId: 'p1', up: 2, down: 1, mine: 1 },
      { planId: 'p2', up: 0, down: 1 },
      { planId: 'p3', up: 0, down: 0 },
    ]);
  });

  it('returns empty for no plan ids without hitting the DB', async () => {
    const counts = await getVoteCounts(stubSupabase([]), []);
    expect(counts).toEqual([]);
  });

  it('ignores votes for plans outside the requested set', async () => {
    const supabase = stubSupabase([{ plan_id: 'other', user_id: 'x', vote: 1 }]);
    const counts = await getVoteCounts(supabase, ['p1']);
    expect(counts).toEqual([{ planId: 'p1', up: 0, down: 0 }]);
  });
});

describe('canVoteOnPlan', () => {
  function stubPlan(row: unknown) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        }),
      }),
    } as unknown as Parameters<typeof canVoteOnPlan>[0];
  }

  it('allows the itinerary owner', async () => {
    const db = stubPlan({
      id: 'p1',
      itinerary_days: [{ itineraries: [{ user_id: 'me', share_code: null }] }],
    });
    expect(await canVoteOnPlan(db, 'p1', 'me')).toBe(true);
  });

  it('allows a friend once the itinerary has been shared', async () => {
    const db = stubPlan({
      id: 'p1',
      itinerary_days: [{ itineraries: [{ user_id: 'owner', share_code: 'abc123' }] }],
    });
    expect(await canVoteOnPlan(db, 'p1', 'friend')).toBe(true);
  });

  it('refuses a stranger on an unshared itinerary', async () => {
    const db = stubPlan({
      id: 'p1',
      itinerary_days: [{ itineraries: [{ user_id: 'owner', share_code: null }] }],
    });
    expect(await canVoteOnPlan(db, 'p1', 'stranger')).toBe(false);
  });

  it('refuses an unknown plan id', async () => {
    expect(await canVoteOnPlan(stubPlan(null), 'nope', 'me')).toBe(false);
  });
});
