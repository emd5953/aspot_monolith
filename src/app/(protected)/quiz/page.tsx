import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { startQuiz } from '@/lib/quiz/progress-service';
import { QuizFlow } from '@/components/quiz/quiz-flow';

export default async function QuizPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Always start fresh - quiz is for updating preferences
  const progress = await startQuiz(supabase, user.id);

  // Debug: Log to verify fresh start
  console.log('🔄 Quiz starting fresh:', {
    currentStep: progress.currentStep,
    answersCount: Object.keys(progress.answers).length,
    timestamp: new Date().toISOString()
  });

  // Use timestamp as key to force remount and reset state
  return <QuizFlow key={Date.now()} initialProgress={progress} userId={user.id} />;
}
