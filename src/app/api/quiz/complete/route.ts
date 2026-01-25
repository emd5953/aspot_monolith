import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProgress, clearProgress } from '@/lib/quiz/progress-service';
import { saveUserPreferences } from '@/lib/quiz/profile-generator';
import { isQuizComplete } from '@/lib/quiz/validation';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current progress
    const progress = await getProgress(supabase, user.id);

    if (!progress) {
      return NextResponse.json(
        { error: 'No quiz in progress' },
        { status: 400 }
      );
    }

    // Validate quiz is complete
    if (!isQuizComplete(progress.answers)) {
      return NextResponse.json(
        { error: 'Quiz is not complete' },
        { status: 400 }
      );
    }

    // Generate and save profile
    const preferences = await saveUserPreferences(supabase, user.id, progress.answers);

    // Clear quiz progress
    await clearProgress(supabase, user.id);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Failed to complete quiz:', error);
    return NextResponse.json(
      { error: 'Failed to complete quiz' },
      { status: 500 }
    );
  }
}
