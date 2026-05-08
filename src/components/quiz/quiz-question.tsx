'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { QuizQuestion, QuizAnswer } from '@/types/quiz';

interface QuizQuestionProps {
  question: QuizQuestion;
  currentAnswer?: QuizAnswer;
  onAnswer: (answer: QuizAnswer) => void;
}

export function QuizQuestionCard({
  question,
  currentAnswer,
  onAnswer,
}: QuizQuestionProps) {
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

  useEffect(() => {
    const newValues = currentAnswer
      ? Array.isArray(currentAnswer.value)
        ? currentAnswer.value
        : [currentAnswer.value as string]
      : [];
    setSelectedValues(newValues);
  }, [currentAnswer, question.id]);

  const handleSingleSelect = (value: string) => {
    setSelectedValues([value]);
    onAnswer({ questionId: question.id, value });
  };

  const handleMultiSelect = (value: string) => {
    let newValues: string[];
    if (selectedValues.includes(value)) {
      newValues = selectedValues.filter((v) => v !== value);
    } else {
      if (question.maxSelections && selectedValues.length >= question.maxSelections) return;
      newValues = [...selectedValues, value];
    }
    setSelectedValues(newValues);
    onAnswer({ questionId: question.id, value: newValues });
  };

  const handleScaleChange = (value: number) => {
    setScaleValue(value);
    onAnswer({ questionId: question.id, value });
  };

  const optionClass = (selected: boolean) =>
    `w-full rounded-2xl border px-5 py-4 text-left transition-all ${
      selected
        ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-white shadow-[0_14px_32px_-14px_rgba(11,30,60,0.45)]'
        : 'border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]'
    }`;

  return (
    <div className="w-full">
      <h2 className="font-heading text-3xl leading-tight text-[color:var(--ink)] md:text-4xl">
        {question.question}
      </h2>
      {question.subtext && (
        <p className="mt-3 text-base text-[color:var(--ink-muted)]">{question.subtext}</p>
      )}

      {question.type === 'single' && question.options && (
        <div className="mt-7 space-y-3">
          {question.options.map((option) => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                key={option.id}
                onClick={() => handleSingleSelect(option.value)}
                className={optionClass(selected)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium">{option.label}</span>
                  {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'multiple' && question.options && (
        <div className="mt-7 space-y-3">
          {question.options.map((option) => {
            const selected = selectedValues.includes(option.value);
            const disabled =
              !selected &&
              question.maxSelections !== undefined &&
              selectedValues.length >= question.maxSelections;
            return (
              <button
                key={option.id}
                onClick={() => handleMultiSelect(option.value)}
                disabled={disabled}
                className={`${optionClass(selected)} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium">{option.label}</span>
                  {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                </div>
              </button>
            );
          })}
          {question.maxSelections && (
            <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
              {selectedValues.length} of {question.maxSelections} selected
              {question.minSelections &&
                selectedValues.length < question.minSelections &&
                ` · pick at least ${question.minSelections}`}
            </p>
          )}
        </div>
      )}

      {question.type === 'scale' && (
        <div className="mt-10">
          <div className="mb-6 flex items-center justify-center">
            <span className="font-heading text-7xl text-[color:var(--ink)]">{scaleValue}</span>
          </div>
          <input
            type="range"
            min={question.scaleMin ?? 1}
            max={question.scaleMax ?? 10}
            value={scaleValue}
            onChange={(e) => handleScaleChange(parseInt(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--surface-soft)] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--ink)] [&::-webkit-slider-thumb]:shadow-[0_4px_12px_rgba(11,30,60,0.3)]"
          />
          <div className="mt-4 flex justify-between text-xs text-[color:var(--ink-muted)]">
            <span>{question.scaleLabels?.min}</span>
            <span>{question.scaleLabels?.max}</span>
          </div>
        </div>
      )}
    </div>
  );
}
