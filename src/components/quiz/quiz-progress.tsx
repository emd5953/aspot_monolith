'use client';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function QuizProgressBar({ currentStep, totalSteps }: QuizProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full">
      <div className="mb-3 flex justify-between text-xs font-medium text-[color:var(--ink-muted)]">
        <span>
          Question {currentStep + 1} of {totalSteps}
        </span>
        <span>{percentage}%</span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--accent)] transition-[width] duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
