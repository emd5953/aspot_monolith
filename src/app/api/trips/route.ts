import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTrip, listUserTrips } from '@/lib/trips/trip-service';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trips = await listUserTrips(supabase, user.id);

    return NextResponse.json({ trips });
  } catch (error) {
    console.error('List trips error:', error);
    return NextResponse.json(
      { error: 'Failed to list trips' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, itineraryId } = body;

    if (!name || !itineraryId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, itineraryId' },
        { status: 400 }
      );
    }

    const trip = await createTrip(supabase, user.id, { name, itineraryId });

    return NextResponse.json({ trip });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trip' },
      { status: 500 }
    );
  }
}
