/**
 * Multi-Agent System Types
 * 
 * Defines the contracts between agents in our agentic architecture.
 */

import { UserPreferences } from '@/types/quiz';
import type { ItemSource } from '@/lib/ai/provenance';

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
  /**
   * Trip dates. Optional — when present they gate + shape the date-aware events
   * search (only run for upcoming trips inside the horizon). See events-search.ts.
   */
  startDate?: Date;
  endDate?: Date;
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

/**
 * Provenance signals shared by every research candidate. Stamped upstream by
 * the research layer: `redditMentions` by the Reddit search pass, `coordinates`
 * only when Google Places verification resolves the place. Both optional —
 * absent when that pass didn't run. Consumed by `deriveSource` in provenance.ts.
 */
interface ResearchProvenance {
  redditMentions?: number;
  coordinates?: { lat: number; lng: number };
}

export interface AttractionData extends ResearchProvenance {
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  /**
   * Free-form price marker as it comes out of research — Tavily emits
   * "$"/"$$"/"free", the LLM extractor sometimes emits "budget"/"moderate".
   * `priceTier` in score-research.ts normalizes both forms.
   */
  priceRange: string;
  rating?: number;
  location?: string;
  tips?: string;
}

export interface RestaurantData extends ResearchProvenance {
  name: string;
  cuisine: string[];
  /** Free-form price marker; see AttractionData.priceRange. */
  priceRange: string;
  rating?: number;
  location?: string;
  mustTry?: string;
}

export interface ActivityData extends ResearchProvenance {
  name: string;
  description: string;
  category: string;
  duration: number;
  adventureLevel: number; // 1-10
  /** Free-form price marker; see AttractionData.priceRange. */
  priceRange: string;
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
  /**
   * Issues from the previous iteration's review, when the orchestrator decided
   * to revise. Fed into the strategy and per-day prompts so a re-plan actually
   * addresses what the reviewer flagged instead of re-rolling blind.
   */
  reviewIssues?: ReviewIssue[];
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
  /**
   * Where this pick came from — `reddit` / `places` / `tavily` / `ai`. Stamped
   * post-planning by matching the item name back to the research pool (see
   * provenance.ts). The `matchReasons` carry the "why we picked this".
   */
  source?: ItemSource;
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
  /**
   * Produce `revisedPlan` when the review rejects the plan. Off by default: a
   * revision is a full-plan model call that only matters on the iteration the
   * orchestrator stops on, so it asks for it explicitly instead of paying for
   * one every round.
   */
  autoRevise?: boolean;
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
