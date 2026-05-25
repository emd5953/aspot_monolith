import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateItinerary } from '@/lib/ai/itinerary-generator';
import { getPreferences } from '@/lib/preferences/preferences-service';
import { normalizePreferences } from '@/lib/preferences/normalize';
import { parsePrompt } from '@/lib/ai/parse-prompt';
import { sendItineraryEmail } from '@/lib/email/send-itinerary';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let {
      destination,
      startDate,
      endDate,
      title,
      generationMode,
      activityDensity,
    }: {
      destination?: string;
      startDate?: string;
      endDate?: string;
      title?: string;
      generationMode?: 'standard' | 'advanced';
      activityDensity?: 'relaxed' | 'moderate' | 'packed';
    } = body;

    // One-shot prompt mode: the client sent a raw natural-language description.
    // Parse it into the structured fields the generator expects.
    if (!destination && typeof body.prompt === 'string' && body.prompt.trim()) {
      const parsed = await parsePrompt(body.prompt.trim());
      destination = parsed.destination;
      startDate = parsed.startDate;
      endDate = parsed.endDate;
      title = title || parsed.title;
      activityDensity = activityDensity || parsed.activityDensity;
    }

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: destination, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get user preferences and normalize to canonical vocab so downstream
    // agents see consistent enum values regardless of when prefs were saved.
    const rawPreferences = await getPreferences(supabase, user.id);
    if (!rawPreferences) {
      return NextResponse.json(
        { error: 'Please complete the quiz first to set your preferences' },
        { status: 400 }
      );
    }
    const preferences = normalizePreferences(rawPreferences);

    const mode = generationMode || 'standard';
    const useAgenticMode = true;
    const useTrulyAgentic = true;
    const useAdvancedCuration = mode === 'advanced';

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

    // Auto-send itinerary email (fire-and-forget — don't block the response)
    if (user.email) {
      sendItineraryEmail({
        to: user.email,
        itineraryId: itinerary.id,
        title: itinerary.title,
        destination: itinerary.destination || destination,
        startDate: itinerary.startDate,
        endDate: itinerary.endDate,
        days: itinerary.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date,
          activities: (day.activities || []).map((act) => ({
            title: (act as unknown as { item?: { name?: string } }).item?.name || (act as unknown as { title?: string }).title || '',
            locationName: (act as unknown as { item?: { address?: string } }).item?.address,
            startTime: undefined,
            endTime: undefined,
            category: (act as unknown as { type?: string }).type || 'activity',
          })),
        })),
      }).catch((err) => console.error('[email] Background send failed:', err));
    }

    return NextResponse.json({ itinerary });
  } catch (error) {
    console.error('Generate itinerary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}
