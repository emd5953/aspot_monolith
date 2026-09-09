import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getItinerary } from '@/lib/ai/itinerary-generator';
import { ownerGuard } from '@/lib/itinerary/ownership';
import { buildItineraryIcs, icsFilename, type IcsItinerary } from '@/lib/calendar/ics';

/**
 * GET /api/itinerary/[id]/calendar
 * Returns the itinerary as a downloadable .ics file (owner only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const itinerary = await getItinerary(supabase, id);
    const guard = ownerGuard(itinerary, user.id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    // One night, one flat list. The .ics day shape survives as a single entry
    // holding every plan; `buildItineraryIcs` already emits a timed VEVENT
    // where a plan has real times and an all-day one where it does not.
    const data: IcsItinerary = {
      id: itinerary!.id,
      title: itinerary!.title,
      days: [
        {
          date: itinerary!.startDate,
          activities: itinerary!.plans.map((plan) => ({
            id: plan.id,
            title: plan.title,
            locationName: plan.locationName,
            notes: plan.notes,
            startTime: plan.startTime,
            endTime: plan.endTime,
          })),
        },
      ],
    };

    const ics = buildItineraryIcs(data);

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${icsFilename(itinerary!.title)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Calendar export error:', error);
    return NextResponse.json({ error: 'Failed to build calendar' }, { status: 500 });
  }
}
