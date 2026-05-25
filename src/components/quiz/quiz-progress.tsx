'use client';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function QuizProgressBar({ currentStep, totalSteps }: QuizProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full">
      <div className="mb-3 flex justify-between text-xs font-medium text-white/80 [text-shadow:0_1px_3px_rgba(10,30,60,0.5)]">
        <span>
          Question {currentStep + 1} of {totalSteps}
        </span>
        <span>{percentage}%</span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-white/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
