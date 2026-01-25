import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addActivity } from '@/lib/itinerary/itinerary-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';

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

    // Verify ownership
    const itinerary = await getItinerary(supabase, id);
    if (!itinerary || itinerary.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { dayId, title, description, locationName, locationCoords, startTime, endTime, category, estimatedCost, notes } = body;

    if (!dayId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: dayId, title' },
        { status: 400 }
      );
    }

    const activity = await addActivity(supabase, dayId, {
      title,
      description,
      locationName,
      locationCoords,
      startTime,
      endTime,
      category,
      estimatedCost,
      notes,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Add activity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add activity' },
      { status: 500 }
    );
  }
}
