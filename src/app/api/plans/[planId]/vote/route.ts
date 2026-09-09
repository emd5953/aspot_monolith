import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { castVote } from '@/lib/itinerary/share-service';

const VoteBody = z.object({ vote: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

/**
 * POST /api/plans/[planId]/vote — 👍 (1), 👎 (-1), or clear (0).
 * Any signed-in user who can see the plan (owner or share-link friend) may
 * vote; RLS scopes writes to the caller's own vote row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = VoteBody.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'vote must be 1, -1, or 0' }, { status: 400 });
    }

    await castVote(supabase, planId, user.id, parsed.data.vote);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
