import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendItineraryEmail } from '@/lib/email/send-itinerary';

/**
 * POST /api/itinerary/[id]/email
 * Sends the itinerary to the authenticated user's email.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the itinerary with days + activities
    const { data: itinerary, error: itinError } = await supabase
      .from('itineraries')
      .select('id, title, destination, start_date, end_date')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (itinError || !itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    const { data: days } = await supabase
      .from('itinerary_days')
      .select('id, day_number, date')
      .eq('itinerary_id', id)
      .order('day_number');

    const daysWithActivities = await Promise.all(
      (days || []).map(async (day) => {
        const { data: activities } = await supabase
          .from('activities')
          .select('title, location_name, start_time, end_time, category')
          .eq('day_id', day.id)
          .order('sort_order');

        return {
          dayNumber: day.day_number,
          date: day.date,
          activities: (activities || []).map((a) => ({
            title: a.title,
            locationName: a.location_name,
            startTime: a.start_time,
            endTime: a.end_time,
            category: a.category,
          })),
        };
      })
    );

    const result = await sendItineraryEmail({
      to: user.email,
      itineraryId: itinerary.id,
      title: itinerary.title,
      destination: itinerary.destination,
      startDate: itinerary.start_date,
      endDate: itinerary.end_date,
      days: daysWithActivities,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
