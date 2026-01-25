import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startQuiz } from '@/lib/quiz/progress-service';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progress = await startQuiz(supabase, user.id);

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Failed to start quiz:', error);
    return NextResponse.json(
      { error: 'Failed to start quiz' },
      { status: 500 }
    );
  }
}
