import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrip, removeMember, updateMemberRole } from '@/lib/trips/trip-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: tripId, userId: targetUserId } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is organizer
    const trip = await getTrip(supabase, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const isOrganizer = trip.members.some(m => m.userId === user.id && m.role === 'organizer');
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Only organizers can update roles' }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !['editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Find member by userId
    const targetMember = trip.members.find(m => m.userId === targetUserId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await updateMemberRole(supabase, tripId, targetMember.id, role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: tripId, userId: targetUserId } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is organizer
    const trip = await getTrip(supabase, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const isOrganizer = trip.members.some(m => m.userId === user.id && m.role === 'organizer');
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Only organizers can remove members' }, { status: 403 });
    }

    // Find member by userId
    const targetMember = trip.members.find(m => m.userId === targetUserId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await removeMember(supabase, tripId, targetMember.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove member' },
      { status: 500 }
    );
  }
}
