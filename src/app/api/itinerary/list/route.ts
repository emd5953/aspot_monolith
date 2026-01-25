import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listItineraries } from '@/lib/ai/itinerary-generator';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const itineraries = await listItineraries(supabase, user.id);

    return NextResponse.json({ itineraries });
  } catch (error) {
    console.error('List itineraries error:', error);
    return NextResponse.json(
      { error: 'Failed to list itineraries' },
      { status: 500 }
    );
  }
}
