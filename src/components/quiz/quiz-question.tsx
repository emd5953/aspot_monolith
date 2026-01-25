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
    if (newValues.length > 0) {
      onAnswer({ questionId: question.id, value: newValues });
    }
  };

  const handleScaleChange = (value: number) => {
    setScaleValue(value);
    onAnswer({ questionId: question.id, value });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{question.question}</h2>
      {question.subtext && (
        <p className="text-gray-600 mb-6">{question.subtext}</p>
      )}

      {question.type === 'single' && question.options && (
        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSingleSelect(option.value)}
              className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                selectedValues.includes(option.value)
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiple' && question.options && (
        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleMultiSelect(option.value)}
              disabled={
                !selectedValues.includes(option.value) &&
                question.maxSelections !== undefined &&
                selectedValues.length >= question.maxSelections
              }
              className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                selectedValues.includes(option.value)
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>{question.scaleLabels?.min}</span>
            <span className="text-2xl font-bold text-indigo-600">{scaleValue}</span>
            <span>{question.scaleLabels?.max}</span>
          </div>
        </div>
      )}
    </div>
  );
}
