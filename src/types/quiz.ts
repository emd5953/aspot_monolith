export type QuestionType = 'single' | 'multiple' | 'scale' | 'text';

export interface QuizOption {
  id: string;
  label: string;
  value: string;
  emoji?: string;
}

export interface QuizQuestion {
  id: string;
  category: string;
  question: string;
  subtext?: string;
  type: QuestionType;
  options?: QuizOption[];
  minSelections?: number;
  maxSelections?: number;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
}

export interface QuizAnswer {
  questionId: string;
  value: string | string[] | number;
}

export interface QuizProgress {
  userId: string;
  currentStep: number;
  answers: Record<string, QuizAnswer>;
  startedAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  cuisinePreferences: string[];
  activityTypes: string[];
  budgetRange: 'budget' | 'moderate' | 'luxury';
  travelPace: 'relaxed' | 'moderate' | 'packed';
  accommodationStyle: 'hostel' | 'hotel' | 'boutique' | 'luxury' | 'airbnb';
  socialPreferences: 'solo' | 'small_group' | 'large_group';
  accessibilityNeeds: string[];
  climatePreferences: string[];
  culturalInterests: string[];
  adventureTolerance: number;
  rawAnswers: Record<string, QuizAnswer>;
  createdAt: Date;
  updatedAt: Date;
}
