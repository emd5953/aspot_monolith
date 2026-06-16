import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateItinerary, getItinerary } from '@/lib/ai/itinerary-generator';
import { ownerGuard } from '@/lib/itinerary/ownership';

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

    // Owner-only: regeneration is destructive and spends on paid AI, so verify
    // ownership before doing any work (RLS alone still lets a trip member in).
    const guard = ownerGuard(await getItinerary(supabase, id), user.id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json().catch(() => ({}));
    const { excludeActivities, focusAreas, useAgenticMode, useTrulyAgentic } = body;

    const itinerary = await regenerateItinerary(supabase, id, {
      excludeActivities,
      focusAreas,
      useAgenticMode: useAgenticMode || false,
      useTrulyAgentic: useTrulyAgentic || false,
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
