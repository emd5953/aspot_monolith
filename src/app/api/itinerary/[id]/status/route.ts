import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
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
    const { status } = body;

    if (!['draft', 'active', 'completed', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: draft, active, completed, or archived' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: itinerary, error: fetchError } = await supabase
      .from('itineraries')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !itinerary) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    if (itinerary.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('itineraries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 }
    );
  }
}
