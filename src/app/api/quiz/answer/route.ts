import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveAnswer } from '@/lib/quiz/progress-service';
import { validateAnswer, getQuestionById } from '@/lib/quiz/validation';
import { QuizAnswer } from '@/types/quiz';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { answer, nextStep } = body as { answer: QuizAnswer; nextStep: number };

    if (!answer || !answer.questionId || answer.value === undefined) {
      return NextResponse.json(
        { error: 'Invalid answer format' },
        { status: 400 }
      );
    }

    // Validate the answer
    const question = getQuestionById(answer.questionId);
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 400 }
      );
    }

    if (!validateAnswer(question, answer)) {
      return NextResponse.json(
        { error: 'Invalid answer for question type' },
        { status: 400 }
      );
    }

    await saveAnswer(supabase, user.id, answer, nextStep);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save answer:', error);
    return NextResponse.json(
      { error: 'Failed to save answer' },
      { status: 500 }
    );
  }
}
