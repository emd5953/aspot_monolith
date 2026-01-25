import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateDayNotes, getDayActivities } from '@/lib/itinerary/itinerary-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const { id, dayId } = await params;
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

    const activities = await getDayActivities(supabase, dayId);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Get day activities error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get day activities' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const { id, dayId } = await params;
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
    const { notes } = body;

    if (notes === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: notes' },
        { status: 400 }
      );
    }

    await updateDayNotes(supabase, dayId, notes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update day notes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update day notes' },
      { status: 500 }
    );
  }
}
