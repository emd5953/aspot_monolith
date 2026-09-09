import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveShareCode, getVoteCounts } from '@/lib/itinerary/share-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';

/**
 * GET /api/shared/[code] — read a shared itinerary (any signed-in friend with
 * the link). Returns the itinerary plus vote tallies per plan.
 *
 * Knowing the unguessable share code IS the permission, so the read runs on
 * the service client and this route is the only gate: sign-in proves identity
 * (for `mine` votes and isOwner), the code proves access. RLS deliberately
 * grants no blanket shared-read — see migration 019.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service client past this point: the code is the capability.
    const db = createServiceClient();

    const itineraryId = await resolveShareCode(db, code);
    if (!itineraryId) {
      return NextResponse.json({ error: 'Unknown share link' }, { status: 404 });
    }

    const itinerary = await getItinerary(db, itineraryId);
    if (!itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    const planIds = itinerary.days.flatMap((d) => d.activities.map((a) => a.id));
    const votes = await getVoteCounts(db, planIds, user.id);

    return NextResponse.json({
      itinerary,
      votes,
      isOwner: itinerary.userId === user.id,
    });
  } catch (error) {
    console.error('Shared itinerary error:', error);
    return NextResponse.json({ error: 'Failed to load shared itinerary' }, { status: 500 });
  }
}
