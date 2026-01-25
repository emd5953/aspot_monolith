import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveActivityToDay } from '@/lib/itinerary/itinerary-service';
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
    const { activityId, targetDayId } = body;

    if (!activityId || !targetDayId) {
      return NextResponse.json(
        { error: 'Missing required fields: activityId, targetDayId' },
        { status: 400 }
      );
    }

    const activity = await moveActivityToDay(supabase, activityId, targetDayId);

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Move activity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to move activity' },
      { status: 500 }
    );
  }
}
