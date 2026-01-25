import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reorderActivities } from '@/lib/itinerary/itinerary-service';
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
    const { dayId, activityIds } = body;

    if (!dayId || !Array.isArray(activityIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: dayId, activityIds (array)' },
        { status: 400 }
      );
    }

    const result = await reorderActivities(supabase, dayId, activityIds);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reorder activities error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder activities' },
      { status: 500 }
    );
  }
}
