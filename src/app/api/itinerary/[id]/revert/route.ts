import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revertToVersion } from '@/lib/itinerary/version-service';

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
