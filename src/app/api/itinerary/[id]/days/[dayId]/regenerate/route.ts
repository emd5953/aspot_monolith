import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateDay } from '@/lib/itinerary/day-regeneration-service';

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
    const { prompt, mode = 'fast' } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (mode !== 'fast' && mode !== 'credible') {
      return NextResponse.json(
        { error: 'Mode must be "fast" or "credible"' },
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

    // Get user preferences
    const { data: prefsData, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (prefsError || !prefsData) {
      return NextResponse.json(
        { error: 'User preferences not found' },
        { status: 400 }
      );
    }

    const preferences = {
      id: prefsData.id,
      userId: prefsData.user_id,
      travelMotivations: prefsData.travel_motivations || [],
      planningStyle: prefsData.planning_style || 'structured_flexible',
      authenticityPreference: prefsData.authenticity_preference || 'balanced',
      timeRhythm: prefsData.time_rhythm || 'steady_daytime',
      comfortZone: prefsData.comfort_zone || 5,
      activityTypes: prefsData.activity_types || [],
      cuisinePreferences: prefsData.cuisine_preferences || [],
      budgetRange: prefsData.budget_range || 'moderate',
      travelPace: prefsData.travel_pace || 'moderate',
      socialPreferences: prefsData.social_preferences || 'solo',
      rawAnswers: prefsData.raw_answers || {},
      createdAt: new Date(prefsData.created_at),
      updatedAt: new Date(prefsData.updated_at),
    };

    // Regenerate the day
    const updatedActivities = await regenerateDay(supabase, {
      itineraryId: id,
      dayId,
      dayNumber: day.day_number,
      date: new Date(day.date),
      destination: itinerary.destination,
      userPrompt: prompt.trim(),
      preferences,
      mode: mode as 'fast' | 'credible',
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
