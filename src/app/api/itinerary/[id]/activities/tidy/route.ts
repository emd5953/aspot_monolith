import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reorderActivities } from '@/lib/itinerary/itinerary-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';
import { ownerGuard } from '@/lib/itinerary/ownership';
import { canTidyDay, nearestNeighborOrder, type OrderablePoint } from '@/lib/itinerary/geo';

/**
 * "Tidy this day" — reorder a day's stops by proximity (greedy nearest-neighbor)
 * to cut down on back-and-forth travel. Pure ordering only: no paid API, just
 * the already-persisted activity coordinates. Refuses days that are already
 * tight or have too few located stops to bother (same gate the UI uses to offer
 * the action).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Owner-only: this mutates activity order, so don't rely on RLS alone.
    const itinerary = await getItinerary(supabase, id);
    const guard = ownerGuard(itinerary, user.id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json();
    const { dayId } = body;
    if (!dayId) {
      return NextResponse.json({ error: 'Missing required field: dayId' }, { status: 400 });
    }

    const day = itinerary!.days.find((d) => d.id === dayId);
    if (!day) {
      return NextResponse.json({ error: 'Day not found in this itinerary' }, { status: 404 });
    }

    const points: OrderablePoint[] = day.activities.map((a) => ({
      id: a.id,
      coordinates: a.locationCoords ?? null,
    }));

    if (!canTidyDay(points)) {
      return NextResponse.json(
        { error: 'This day is already well-ordered or has too few located stops to tidy.' },
        { status: 409 }
      );
    }

    const orderedIds = nearestNeighborOrder(points);
    const result = await reorderActivities(supabase, dayId, orderedIds);

    return NextResponse.json({ ...result, activityIds: orderedIds });
  } catch (error) {
    console.error('Tidy day error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to tidy day' },
      { status: 500 }
    );
  }
}
