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

    const body = await request.json();
    const { status } = body;

    if (status) {
      await updateItineraryStatus(supabase, id, status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update itinerary error:', error);
    return NextResponse.json(
      { error: 'Failed to update itinerary' },
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
