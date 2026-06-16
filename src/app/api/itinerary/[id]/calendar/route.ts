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

    // getItinerary returns a non-null StoredItinerary here (guard.ok) with flat,
    // properly-typed activities — no cast needed.
    const data: IcsItinerary = {
      id: itinerary!.id,
      title: itinerary!.title,
      days: itinerary!.days.map((day) => ({
        date: day.date,
        activities: day.activities.map((act) => ({
          id: act.id,
          title: act.title,
          locationName: act.locationName,
          notes: act.notes,
          startTime: act.startTime,
          endTime: act.endTime,
        })),
      })),
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
