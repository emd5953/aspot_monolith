import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateItinerary } from '@/lib/ai/itinerary-generator';
import { getPreferences } from '@/lib/preferences/preferences-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { destination, startDate, endDate, title, generationMode, activityDensity } = body;

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: destination, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get user preferences
    const preferences = await getPreferences(supabase, user.id);
    if (!preferences) {
      return NextResponse.json(
        { error: 'Please complete the quiz first to set your preferences' },
        { status: 400 }
      );
    }

    // Map generation mode to flags
    const mode = generationMode || 'standard';
    const useAgenticMode = true;
    const useTrulyAgentic = true;
    const useAdvancedCuration = mode === 'advanced';

    // Generate itinerary
    const itinerary = await generateItinerary(
      supabase,
      {
        userId: user.id,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        title,
        activityDensity: activityDensity || 'moderate',
      },
      preferences,
      useAgenticMode,
      useTrulyAgentic,
      useAdvancedCuration
    );

    return NextResponse.json({ itinerary });
  } catch (error) {
    console.error('Generate itinerary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}
