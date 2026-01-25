import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateItinerary } from '@/lib/ai/itinerary-generator';

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const { excludeActivities, focusAreas } = body;

    const itinerary = await regenerateItinerary(supabase, id, {
      excludeActivities,
      focusAreas,
    });

    return NextResponse.json({ itinerary });
  } catch (error) {
    console.error('Regenerate itinerary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate itinerary' },
      { status: 500 }
    );
  }
}
