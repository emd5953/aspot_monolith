'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import Link from 'next/link';

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

  // Reset state when initialProgress changes (e.g., when quiz is restarted)
  useEffect(() => {
    console.log('🔄 QuizFlow useEffect triggered:', {
      initialStep: initialProgress?.currentStep,
      initialAnswersCount: Object.keys(initialProgress?.answers ?? {}).length,
    });
    setCurrentStep(initialProgress?.currentStep ?? 0);
    setAnswers(initialProgress?.answers ?? {});
  }, [initialProgress]);

  const currentQuestion = quizQuestions[currentStep];
  const isLastQuestion = currentStep === quizQuestions.length - 1;
  const currentAnswer = answers[currentQuestion?.id];
  const hasAnswer = currentAnswer && validateAnswer(currentQuestion, currentAnswer);

  const handleAnswer = (answer: QuizAnswer) => {
    setAnswers((prev) => ({
      ...prev,
      [answer.questionId]: answer,
    }));
  };

  const handleNext = async () => {
    if (!hasAnswer) return;

    setIsSubmitting(true);
    try {
      const nextStep = currentStep + 1;
      await saveAnswer(supabase, userId, answers[currentQuestion.id], nextStep);

      if (isLastQuestion) {
        // Complete quiz and generate profile
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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen py-12 px-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <Link href="/dashboard">
          <h1 className="text-3xl font-heading text-foreground -rotate-1 inline-block mb-6">
            ✈️ aSpot - AI Itinerary Planner
          </h1>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        <QuizProgressBar currentStep={currentStep} totalSteps={quizQuestions.length} />

        <HandDrawnCard decoration="tape" className="p-8">
          <QuizQuestionCard
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id]}
            onAnswer={handleAnswer}
          />

          <div className="flex justify-between mt-8 pt-6 border-t-2 border-dashed border-foreground/20">
            <HandDrawnButton
              onClick={handleBack}
              disabled={currentStep === 0}
              variant="secondary"
            >
              Back
            </HandDrawnButton>
            <HandDrawnButton
              onClick={handleNext}
              disabled={!hasAnswer || isSubmitting}
              variant="accent"
            >
              {isSubmitting ? 'Saving...' : isLastQuestion ? 'Complete' : 'Next'}
            </HandDrawnButton>
          </div>
        </HandDrawnCard>
      </div>
    </div>
  );
}
