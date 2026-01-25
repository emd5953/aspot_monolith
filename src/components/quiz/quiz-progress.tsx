'use client';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function QuizProgressBar({ currentStep, totalSteps }: QuizProgressProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between text-lg text-foreground mb-3 font-body">
        <span>Question {currentStep + 1} of {totalSteps}</span>
        <span>{percentage}% complete</span>
      </div>
      <div className="w-full bg-muted border-2 border-foreground border-wobbly-sm h-6 relative overflow-hidden">
        <div
          className="bg-accent h-full transition-all duration-300 border-r-2 border-foreground"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
