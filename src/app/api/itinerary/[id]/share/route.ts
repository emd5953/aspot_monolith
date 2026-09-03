import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureShareCode } from '@/lib/itinerary/share-service';
import { getItinerary } from '@/lib/ai/itinerary-generator';
import { ownerGuard } from '@/lib/itinerary/ownership';

/** POST /api/itinerary/[id]/share — mint (or fetch) the share link code. Owner-only. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const itinerary = await getItinerary(supabase, id);
    const guard = ownerGuard(itinerary, user.id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const code = await ensureShareCode(supabase, id);
    return NextResponse.json({ code, path: `/s/${code}` });
  } catch (error) {
    console.error('Share code error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
