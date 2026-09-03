import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

/**
 * Share links + lightweight votes — Spotz's collaboration surface.
 * A share code makes an itinerary viewable + votable by any signed-in friend
 * with the link. Votes are 👍/👎 reactions on individual plans; the owner
 * keeps edit control. No roles, no membership, no governance.
 */

export interface VoteCounts {
  planId: string;
  up: number;
  down: number;
  /** The requesting user's own vote, when they cast one. */
  mine?: 1 | -1;
}

/** Create (or return the existing) share code for an itinerary. Owner-only — callers guard. */
export async function ensureShareCode(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from('itineraries')
    .select('share_code')
    .eq('id', itineraryId)
    .single();
  if (readError) throw new Error(`share lookup failed: ${readError.message}`);
  if (existing?.share_code) return existing.share_code;

  // URL-friendly, unguessable-enough for a party link.
  const code = randomBytes(6).toString('base64url');
  const { error } = await supabase
    .from('itineraries')
    .update({ share_code: code })
    .eq('id', itineraryId);
  if (error) throw new Error(`share code save failed: ${error.message}`);
  return code;
}

/** Resolve a share code to its itinerary id (null when unknown). */
export async function resolveShareCode(
  supabase: SupabaseClient,
  code: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('id')
    .eq('share_code', code)
    .maybeSingle();
  if (error) throw new Error(`share resolve failed: ${error.message}`);
  return data?.id ?? null;
}

/** Cast/replace a vote (+1 / -1) on a plan. vote=0 removes the vote. */
export async function castVote(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
  vote: 1 | -1 | 0
): Promise<void> {
  if (vote === 0) {
    const { error } = await supabase
      .from('plan_votes')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', userId);
    if (error) throw new Error(`vote remove failed: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('plan_votes').upsert(
    {
      plan_id: planId,
      user_id: userId,
      vote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'plan_id,user_id' }
  );
  if (error) throw new Error(`vote failed: ${error.message}`);
}

/** Tally votes for a set of plans (one itinerary's worth). */
export async function getVoteCounts(
  supabase: SupabaseClient,
  planIds: string[],
  requestingUserId?: string
): Promise<VoteCounts[]> {
  if (planIds.length === 0) return [];

  const { data, error } = await supabase
    .from('plan_votes')
    .select('plan_id, user_id, vote')
    .in('plan_id', planIds);
  if (error) throw new Error(`vote read failed: ${error.message}`);

  const byPlan = new Map<string, VoteCounts>();
  for (const id of planIds) {
    byPlan.set(id, { planId: id, up: 0, down: 0 });
  }
  for (const row of data ?? []) {
    const counts = byPlan.get(row.plan_id);
    if (!counts) continue;
    if (row.vote === 1) counts.up++;
    else if (row.vote === -1) counts.down++;
    if (requestingUserId && row.user_id === requestingUserId) {
      counts.mine = row.vote as 1 | -1;
    }
  }
  return [...byPlan.values()];
}
