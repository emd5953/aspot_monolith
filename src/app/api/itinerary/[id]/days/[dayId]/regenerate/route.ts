import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateDay } from '@/lib/itinerary/day-regeneration-service';
import { defaultPreferencesFor } from '@/types/profile';

export async function POST(
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

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: itinerary, error: fetchError } = await supabase
      .from('itineraries')
      .select('user_id, destination, start_date, end_date')
      .eq('id', id)
      .single();

    if (fetchError || !itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    if (itinerary.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify day exists
    const { data: day, error: dayError } = await supabase
      .from('itinerary_days')
      .select('id, day_number, date')
      .eq('id', dayId)
      .eq('itinerary_id', id)
      .single();

    if (dayError || !day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    // Spotz: no quiz — regeneration steers by the user's prompt alone.
    const preferences = defaultPreferencesFor(user.id);

    // Regenerate the day
    const updatedActivities = await regenerateDay(supabase, {
      itineraryId: id,
      dayId,
      dayNumber: day.day_number,
      date: new Date(day.date),
      destination: itinerary.destination,
      userPrompt: prompt.trim(),
      preferences,
    });

    return NextResponse.json({ 
      success: true,
      activities: updatedActivities,
    });
  } catch (error) {
    console.error('Regenerate day error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate day' },
      { status: 500 }
    );
  }
}
