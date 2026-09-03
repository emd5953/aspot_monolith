import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveShareCode, getVoteCounts } from '@/lib/itinerary/share-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';

/**
 * GET /api/shared/[code] — read a shared itinerary (any signed-in friend with
 * the link). Returns the itinerary plus vote tallies per plan.
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

    const itineraryId = await resolveShareCode(supabase, code);
    if (!itineraryId) {
      return NextResponse.json({ error: 'Unknown share link' }, { status: 404 });
    }

    const itinerary = await getItinerary(supabase, itineraryId);
    if (!itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    const planIds = itinerary.days.flatMap((d) => d.activities.map((a) => a.id));
    const votes = await getVoteCounts(supabase, planIds, user.id);

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
