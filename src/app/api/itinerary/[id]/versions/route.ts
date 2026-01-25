import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listVersions, createVersionSnapshot } from '@/lib/itinerary/version-service';

export async function GET(
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

    const versions = await listVersions(supabase, id);

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('List versions error:', error);
    return NextResponse.json(
      { error: 'Failed to list versions' },
      { status: 500 }
    );
  }
}

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
    const { description } = body;

    const version = await createVersionSnapshot(supabase, id, user.id, description);

    return NextResponse.json({ version });
  } catch (error) {
    console.error('Create version error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
