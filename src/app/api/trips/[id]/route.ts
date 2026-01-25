import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrip, deleteTrip } from '@/lib/trips/trip-service';

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

    const trip = await getTrip(supabase, id);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Check if user is a member
    const isMember = trip.members.some(m => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ trip });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json(
      { error: 'Failed to get trip' },
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

    // Check if user is organizer
    const trip = await getTrip(supabase, id);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const isOrganizer = trip.members.some(m => m.userId === user.id && m.role === 'organizer');
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Only organizers can delete trips' }, { status: 403 });
    }

    await deleteTrip(supabase, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trip error:', error);
    return NextResponse.json(
      { error: 'Failed to delete trip' },
      { status: 500 }
    );
  }
}
