import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revertToVersion } from '@/lib/itinerary/version-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';
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

    // Owner-only: revert overwrites the entire itinerary, so don't rely on RLS
    // alone — match the explicit ownership check the sibling routes use.
    const guard = ownerGuard(await getItinerary(supabase, id), user.id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'Missing versionId' },
        { status: 400 }
      );
    }

    await revertToVersion(supabase, id, versionId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revert version error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revert' },
      { status: 500 }
    );
  }
}
