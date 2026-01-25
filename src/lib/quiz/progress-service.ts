import { SupabaseClient } from '@supabase/supabase-js';
import { QuizAnswer, QuizProgress } from '@/types/quiz';

export interface QuizProgressRow {
  id: string;
  user_id: string;
  current_step: number;
  answers: Record<string, QuizAnswer>;
  started_at: string;
  updated_at: string;
}

export async function saveProgress(
  supabase: SupabaseClient,
  userId: string,
  currentStep: number,
  answers: Record<string, QuizAnswer>
): Promise<void> {
  const { error } = await supabase.from('quiz_progress').upsert(
    {
      user_id: userId,
      current_step: currentStep,
      answers: answers,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  if (error) {
    throw new Error(`Failed to save quiz progress: ${error.message}`);
  }
}

export async function getProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<QuizProgress | null> {
  const { data, error } = await supabase
    .from('quiz_progress')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user hasn't started quiz
      return null;
    }
    throw new Error(`Failed to get quiz progress: ${error.message}`);
  }

  if (!data) return null;

  const row = data as QuizProgressRow;
  return {
    userId: row.user_id,
    currentStep: row.current_step,
    answers: row.answers,
    startedAt: new Date(row.started_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function saveAnswer(
  supabase: SupabaseClient,
  userId: string,
  answer: QuizAnswer,
  nextStep: number
): Promise<void> {
  // Get current progress
  const currentProgress = await getProgress(supabase, userId);

  const updatedAnswers = {
    ...(currentProgress?.answers || {}),
    [answer.questionId]: answer,
  };

  await saveProgress(supabase, userId, nextStep, updatedAnswers);
}

export async function clearProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('quiz_progress')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to clear quiz progress: ${error.message}`);
  }
}

export async function startQuiz(
  supabase: SupabaseClient,
  userId: string
): Promise<QuizProgress> {
  // Clear any existing progress
  await clearProgress(supabase, userId);

  // Create new progress
  const { error } = await supabase.from('quiz_progress').insert({
    user_id: userId,
    current_step: 0,
    answers: {},
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to start quiz: ${error.message}`);
  }

  return {
    userId,
    currentStep: 0,
    answers: {},
    startedAt: new Date(),
    updatedAt: new Date(),
  };
}
