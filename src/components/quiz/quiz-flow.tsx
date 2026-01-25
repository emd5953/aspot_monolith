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

  const currentQuestion = quizQuestions[currentStep];
  const isLastQuestion = currentStep === quizQuestions.length - 1;
  const hasAnswer = answers[currentQuestion?.id];

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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <QuizProgressBar currentStep={currentStep} totalSteps={quizQuestions.length} />

        <div className="bg-white rounded-xl shadow-sm p-8">
          <QuizQuestionCard
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id]}
            onAnswer={handleAnswer}
          />

          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!hasAnswer || isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : isLastQuestion ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
