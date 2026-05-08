'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { QuizAnswer, QuizProgress } from '@/types/quiz';
import { quizQuestions } from '@/data/quiz-questions';
import { QuizProgressBar } from './quiz-progress';
import { QuizQuestionCard } from './quiz-question';
import { createClient } from '@/lib/supabase/client';
import { saveAnswer } from '@/lib/quiz/progress-service';
import { saveUserPreferences } from '@/lib/quiz/profile-generator';
import { validateAnswer } from '@/lib/quiz/validation';
import { HandDrawnButton } from '@/components/ui/hand-drawn-button';
import { HandDrawnCard } from '@/components/ui/hand-drawn-card';
import { AppNav } from '@/components/layout/app-nav';
import { PromoChip } from '@/components/ui/promo-chip';

interface QuizFlowProps {
  initialProgress?: QuizProgress | null;
  userId: string;
}

export function QuizFlow({ initialProgress, userId }: QuizFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialProgress?.currentStep ?? 0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>(
    initialProgress?.answers ?? {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setCurrentStep(initialProgress?.currentStep ?? 0);
    setAnswers(initialProgress?.answers ?? {});
  }, [initialProgress]);

  const currentQuestion = quizQuestions[currentStep];
  const isLastQuestion = currentStep === quizQuestions.length - 1;
  const currentAnswer = answers[currentQuestion?.id];
  const hasAnswer = currentAnswer && validateAnswer(currentQuestion, currentAnswer);

  const handleAnswer = (answer: QuizAnswer) => {
    setAnswers((prev) => ({ ...prev, [answer.questionId]: answer }));
  };

  const handleNext = async () => {
    if (!hasAnswer) return;

    setIsSubmitting(true);
    try {
      const nextStep = currentStep + 1;
      await saveAnswer(supabase, userId, answers[currentQuestion.id], nextStep);

      if (isLastQuestion) {
        await saveUserPreferences(supabase, userId, answers);
        router.push('/quiz/complete');
      } else {
        setCurrentStep(nextStep);
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (!currentQuestion) return null;

  return (
    <div className="relative min-h-screen">
      <AppNav />

      <main className="relative mx-auto max-w-2xl px-6 pt-32 pb-24">
        <section className="animate-fade-up">
          <PromoChip>
            Question {currentStep + 1} of {quizQuestions.length}
          </PromoChip>
          <h1 className="mt-5 font-heading text-4xl leading-[1] text-[color:var(--ink)] md:text-5xl">
            Shape your <span className="italic">travel personality</span>.
          </h1>
        </section>

        <div className="mt-8">
          <QuizProgressBar currentStep={currentStep} totalSteps={quizQuestions.length} />
        </div>

        <HandDrawnCard
          key={currentStep}
          className="animate-fade-up mt-8 p-7"
          style={{ animationDelay: '0.05s' }}
        >
          <QuizQuestionCard
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id]}
            onAnswer={handleAnswer}
          />

          <div className="mt-8 flex items-center justify-between border-t border-[color:var(--border)] pt-6">
            <HandDrawnButton
              onClick={handleBack}
              disabled={currentStep === 0}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              Back
            </HandDrawnButton>
            <HandDrawnButton
              onClick={handleNext}
              disabled={!hasAnswer || isSubmitting}
              variant="primary"
              size="sm"
              className="gap-2"
            >
              {isSubmitting ? 'Saving…' : isLastQuestion ? 'Complete' : 'Next'}
              {!isSubmitting && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </HandDrawnButton>
          </div>
        </HandDrawnCard>
      </main>
    </div>
  );
}
