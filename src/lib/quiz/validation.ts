import { QuizQuestion, QuizAnswer } from '@/types/quiz';
import { quizQuestions } from '@/data/quiz-questions';

export function validateAnswer(question: QuizQuestion, answer: QuizAnswer): boolean {
  if (answer.questionId !== question.id) {
    return false;
  }

  switch (question.type) {
    case 'single':
      if (typeof answer.value !== 'string') return false;
      if (!question.options) return false;
      return question.options.some((opt) => opt.value === answer.value);

    case 'multiple':
      if (!Array.isArray(answer.value)) return false;
      if (!question.options) return false;
      if (question.maxSelections && answer.value.length > question.maxSelections) return false;
      if (question.minSelections && answer.value.length < question.minSelections) return false;
      return answer.value.every((v) => question.options!.some((opt) => opt.value === v));

    case 'scale':
      if (typeof answer.value !== 'number') return false;
      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 10;
      return answer.value >= min && answer.value <= max;

    case 'text':
      return typeof answer.value === 'string' && answer.value.length > 0;

    default:
      return false;
  }
}

export function getQuestionById(questionId: string): QuizQuestion | undefined {
  return quizQuestions.find((q) => q.id === questionId);
}

export function isQuizComplete(answers: Record<string, QuizAnswer>): boolean {
  return quizQuestions.every((question) => {
    const answer = answers[question.id];
    return answer && validateAnswer(question, answer);
  });
}

export function getQuizProgress(answers: Record<string, QuizAnswer>): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = quizQuestions.length;
  const completed = quizQuestions.filter((q) => {
    const answer = answers[q.id];
    return answer && validateAnswer(q, answer);
  }).length;

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}
