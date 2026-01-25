import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProgress } from '@/lib/quiz/progress-service';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progress = await getProgress(supabase, user.id);

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Failed to get quiz progress:', error);
    return NextResponse.json(
      { error: 'Failed to get quiz progress' },
      { status: 500 }
    );
  }
}
