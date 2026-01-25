import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getItinerary, updateItineraryStatus, deleteItinerary } from '@/lib/ai/itinerary-generator';

export async function GET(
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

    const itinerary = await getItinerary(supabase, id);
    if (!itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    // Check ownership
    if (itinerary.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ itinerary });
  } catch (error) {
    console.error('Get itinerary error:', error);
    return NextResponse.json(
      { error: 'Failed to get itinerary' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { status, title, destination, startDate, endDate } = body;

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;
    if (destination !== undefined) updates.destination = destination;
    if (startDate !== undefined) updates.start_date = new Date(startDate).toISOString().split('T')[0];
    if (endDate !== undefined) updates.end_date = new Date(endDate).toISOString().split('T')[0];

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('itineraries')
        .update(updates)
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to update itinerary: ${error.message}`);
      }
    }

    const updatedItinerary = await getItinerary(supabase, id);
    return NextResponse.json({ itinerary: updatedItinerary });
  } catch (error) {
    console.error('Update itinerary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update itinerary' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await deleteItinerary(supabase, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete itinerary error:', error);
    return NextResponse.json(
      { error: 'Failed to delete itinerary' },
      { status: 500 }
    );
  }
}
