import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateActivity, removeActivity } from '@/lib/itinerary/itinerary-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id, activityId } = await params;
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
    const { title, description, locationName, locationCoords, startTime, endTime, category, estimatedCost, notes } = body;

    const activity = await updateActivity(supabase, activityId, {
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
    console.error('Update activity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update activity' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id, activityId } = await params;
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

    await removeActivity(supabase, activityId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete activity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete activity' },
      { status: 500 }
    );
  }
}
