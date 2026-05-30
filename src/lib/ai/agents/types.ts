/**
 * Multi-Agent System Types
 * 
 * Defines the contracts between agents in our agentic architecture.
 */

import { UserPreferences } from '@/types/quiz';

// Agent message types for inter-agent communication
export interface AgentMessage {
  from: AgentRole;
  to: AgentRole;
  type: 'request' | 'response' | 'update' | 'error';
  content: unknown;
  timestamp: Date;
}

export type AgentRole = 'orchestrator' | 'researcher' | 'planner' | 'reviewer';

// Agent state for tracking progress
export interface AgentState {
  status: 'idle' | 'thinking' | 'executing' | 'waiting' | 'complete' | 'error';
  currentTask?: string;
  progress: number; // 0-100
  thoughts: string[]; // Chain of thought reasoning
  lastUpdate: Date;
}

// Research Agent types
export interface ResearchRequest {
  destination: string;
  preferences: UserPreferences;
  focusAreas?: string[];
  useAdvancedMode?: boolean; // Enable extensive scraping
  /**
   * The user's free-text focus extracted from their prompt
   * (e.g. "R&B-leaning bars and live-music nightlife"). Used to bias
   * search queries so the research pool actually contains on-theme places.
   * Empty string when the user gave no theme.
   */
  userIntent?: string;
  /** Original prompt verbatim — used as-is in some search/extraction prompts. */
  rawPrompt?: string;
}

export interface ResearchResult {
  destination: string;
  attractions: AttractionData[];
  restaurants: RestaurantData[];
  activities: ActivityData[];
  localInsights: string[];
  weatherInfo?: string;
  bestTimeToVisit?: string;
  sources: string[];
}

export interface AttractionData {
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  priceRange: 'free' | 'budget' | 'moderate' | 'expensive' | 'luxury';
  rating?: number;
  location?: string;
  tips?: string;
}

export interface RestaurantData {
  name: string;
  cuisine: string[];
  priceRange: 'budget' | 'moderate' | 'expensive' | 'luxury';
  rating?: number;
  location?: string;
  mustTry?: string;
}

export interface ActivityData {
  name: string;
  description: string;
  category: string;
  duration: number;
  adventureLevel: number; // 1-10
  priceRange: 'free' | 'budget' | 'moderate' | 'expensive';
  bestTime?: 'morning' | 'afternoon' | 'evening' | 'anytime';
}

// Planner Agent types
export interface PlanRequest {
  research: ResearchResult;
  preferences: UserPreferences;
  startDate: Date;
  endDate: Date;
  /** User focus / theme to optimize the plan around. Empty if none. */
  userIntent?: string;
  /** Original prompt verbatim. */
  rawPrompt?: string;
}

export interface DayPlan {
  dayNumber: number;
  date: string;
  theme?: string;
  morning: ScheduledItem[];
  afternoon: ScheduledItem[];
  evening: ScheduledItem[];
  notes: string;
  estimatedCost: string;
}

export interface ScheduledItem {
  time: string;
  name: string;
  type: 'attraction' | 'restaurant' | 'activity' | 'transport' | 'free_time';
  duration: number;
  description?: string;
  tips?: string;
  matchScore?: number;
  matchReasons?: string[];
}

export interface ItineraryPlan {
  destination: string;
  summary: string;
  days: DayPlan[];
  totalEstimatedCost: string;
  packingTips?: string[];
  importantNotes?: string[];
}

// Reviewer Agent types
export interface ReviewRequest {
  plan: ItineraryPlan;
  preferences: UserPreferences;
  research: ResearchResult;
  /** User focus / theme. Reviewer scores intent alignment when present. */
  userIntent?: string;
  /** Original prompt verbatim. */
  rawPrompt?: string;
}

export interface ReviewResult {
  approved: boolean;
  score: number; // 0-100
  issues: ReviewIssue[];
  suggestions: string[];
  revisedPlan?: ItineraryPlan;
}

export interface ReviewIssue {
  severity: 'low' | 'medium' | 'high';
  dayNumber?: number;
  issue: string;
  suggestion: string;
}

// Orchestrator types
export interface OrchestrationState {
  sessionId: string;
  status: 'initializing' | 'researching' | 'planning' | 'reviewing' | 'revising' | 'complete' | 'error';
  iteration: number;
  maxIterations: number;
  agents: Record<AgentRole, AgentState>;
  research?: ResearchResult;
  plan?: ItineraryPlan;
  review?: ReviewResult;
  finalPlan?: ItineraryPlan;
  logs: OrchestrationLog[];
}

export interface OrchestrationLog {
  timestamp: Date;
  agent: AgentRole;
  action: string;
  details?: string;
}
