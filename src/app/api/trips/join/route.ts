import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { joinTrip } from '@/lib/trips/trip-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Missing invite code' },
        { status: 400 }
      );
    }

    const member = await joinTrip(supabase, user.id, inviteCode);

    return NextResponse.json({ member, tripId: member.tripId });
  } catch (error) {
    console.error('Join trip error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to join trip' },
      { status: 500 }
    );
  }
}
