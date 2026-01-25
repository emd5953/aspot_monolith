'use client';

import { useState } from 'react';
import { QuizQuestion, QuizAnswer } from '@/types/quiz';

interface QuizQuestionProps {
  question: QuizQuestion;
  currentAnswer?: QuizAnswer;
  onAnswer: (answer: QuizAnswer) => void;
}

export function QuizQuestionCard({ question, currentAnswer, onAnswer }: QuizQuestionProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>(
    currentAnswer
      ? Array.isArray(currentAnswer.value)
        ? currentAnswer.value
        : [currentAnswer.value as string]
      : []
  );
  const [scaleValue, setScaleValue] = useState<number>(
    currentAnswer && typeof currentAnswer.value === 'number'
      ? currentAnswer.value
      : question.scaleMin ?? 5
  );

  const handleSingleSelect = (value: string) => {
    setSelectedValues([value]);
    onAnswer({ questionId: question.id, value });
  };

  const handleMultiSelect = (value: string) => {
    let newValues: string[];
    if (selectedValues.includes(value)) {
      newValues = selectedValues.filter((v) => v !== value);
    } else {
      if (question.maxSelections && selectedValues.length >= question.maxSelections) {
        return;
      }
      newValues = [...selectedValues, value];
    }
    setSelectedValues(newValues);
    onAnswer({ questionId: question.id, value: newValues });
  };

  const handleScaleChange = (value: number) => {
    setScaleValue(value);
    onAnswer({ questionId: question.id, value });
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-heading text-foreground mb-3">{question.question}</h2>
      {question.subtext && (
        <p className="text-lg text-foreground/70 mb-8 font-body">{question.subtext}</p>
      )}

      {question.type === 'single' && question.options && (
        <div className="space-y-4">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSingleSelect(option.value)}
              className={`w-full p-5 text-left border-wobbly-sm border-[3px] transition-all font-body text-lg ${
                selectedValues.includes(option.value)
                  ? 'border-accent bg-accent/10 shadow-hand-sm'
                  : 'border-foreground bg-card hover:shadow-hand-sm hover:-rotate-1'
              }`}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiple' && question.options && (
        <div className="space-y-4">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleMultiSelect(option.value)}
              disabled={
                !selectedValues.includes(option.value) &&
                question.maxSelections !== undefined &&
                selectedValues.length >= question.maxSelections
              }
              className={`w-full p-5 text-left border-wobbly-sm border-[3px] transition-all font-body text-lg ${
                selectedValues.includes(option.value)
                  ? 'border-accent bg-accent/10 shadow-hand-sm'
                  : 'border-foreground bg-card hover:shadow-hand-sm hover:rotate-1 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <span>{option.label}</span>
            </button>
          ))}
          {question.maxSelections && (
            <p className="text-sm text-foreground/60 font-body mt-2">
              Select up to {question.maxSelections} options
            </p>
          )}
        </div>
      )}

      {question.type === 'scale' && (
        <div className="mt-8">
          <input
            type="range"
            min={question.scaleMin ?? 1}
            max={question.scaleMax ?? 10}
            value={scaleValue}
            onChange={(e) => handleScaleChange(parseInt(e.target.value))}
            className="w-full h-3 bg-muted border-2 border-foreground appearance-none cursor-pointer accent-accent"
            style={{ borderRadius: '15px' }}
          />
          <div className="flex justify-between mt-4 text-base text-foreground/70 font-body">
            <span>{question.scaleLabels?.min}</span>
            <span className="text-4xl font-heading text-accent">{scaleValue}</span>
            <span>{question.scaleLabels?.max}</span>
          </div>
        </div>
      )}
    </div>
  );
}
