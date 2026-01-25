import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProgress, startQuiz } from '@/lib/quiz/progress-service';
import { QuizFlow } from '@/components/quiz/quiz-flow';

export default async function QuizPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get or create quiz progress
  let progress = await getProgress(supabase, user.id);
  
  if (!progress) {
    progress = await startQuiz(supabase, user.id);
  }

  return <QuizFlow initialProgress={progress} userId={user.id} />;
}
