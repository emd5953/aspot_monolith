'use client';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function QuizProgressBar({ currentStep, totalSteps }: QuizProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Question {currentStep + 1} of {totalSteps}</span>
        <span>{percentage}% complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
