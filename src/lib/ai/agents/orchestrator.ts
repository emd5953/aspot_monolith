/**
 * Agent Orchestrator
 * 
 * Coordinates multiple specialized agents to create itineraries.
 * Implements autonomous decision loops with self-correction.
 * 
 * Flow:
 * 1. Research Agent gathers destination data
 * 2. Planner Agent creates initial itinerary
 * 3. Reviewer Agent validates and scores
 * 4. If issues found, loop back to Planner with feedback
 * 5. Continue until approved or max iterations reached
 */

import { UserPreferences } from '@/types/quiz';
import { OrchestrationState, OrchestrationLog, ItineraryPlan, ResearchResult } from './types';
import { runResearchAgent } from './researcher';
import { runPlannerAgent } from './planner';
import { runReviewerAgent } from './reviewer';
import { getCachedResearch, setCachedResearch } from '../research-cache';
import { curateResearchByPreferences } from '@/lib/preferences/score-research';

const MAX_ITERATIONS = 3;

export interface OrchestratorInput {
  destination: string;
  startDate: Date;
  endDate: Date;
  preferences: UserPreferences;
  /** Free-text user focus extracted from the original prompt. Optional. */
  userIntent?: string;
  /** Original prompt verbatim. Optional. */
  rawPrompt?: string;
  onProgress?: (state: OrchestrationState) => void;
}

export interface OrchestratorOutput {
  success: boolean;
  plan?: ItineraryPlan;
  research?: ResearchResult;
  state: OrchestrationState;
  error?: string;
}

/**
 * Initialize orchestration state
 */
function createInitialState(sessionId: string): OrchestrationState {
  const now = new Date();
  return {
    sessionId,
    status: 'initializing',
    iteration: 0,
    maxIterations: MAX_ITERATIONS,
    agents: {
      orchestrator: { status: 'thinking', progress: 0, thoughts: [], lastUpdate: now },
      researcher: { status: 'idle', progress: 0, thoughts: [], lastUpdate: now },
      planner: { status: 'idle', progress: 0, thoughts: [], lastUpdate: now },
      reviewer: { status: 'idle', progress: 0, thoughts: [], lastUpdate: now },
    },
    logs: [],
  };
}

/**
 * Add log entry
 */
function log(state: OrchestrationState, agent: keyof OrchestrationState['agents'], action: string, details?: string): void {
  state.logs.push({
    timestamp: new Date(),
    agent,
    action,
    details,
  });
}

/**
 * Run the multi-agent orchestration
 */
export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { destination, startDate, endDate, preferences, userIntent, rawPrompt, onProgress } = input;
  const sessionId = `session_${Date.now()}`;
  const state = createInitialState(sessionId);

  const notify = () => onProgress?.(structuredClone(state));

  try {
    // ========== PHASE 1: RESEARCH ==========
    state.status = 'researching';
    state.agents.orchestrator.thoughts.push(`Starting itinerary generation for ${destination}`);
    state.agents.orchestrator.thoughts.push(`Trip duration: ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days`);
    state.agents.orchestrator.thoughts.push(`Mode: Agentic (Web research + Review loops)`);
    log(state, 'orchestrator', 'Starting research phase');
    notify();

    state.agents.researcher.status = 'executing';
    state.agents.researcher.currentTask = `Researching ${destination}`;
    state.agents.researcher.progress = 10;
    notify();

    // Check cache first — saves 30s-10min on repeat destinations.
    // Cache key includes userIntent so an "R&B bars" pool isn't served to a
    // generic "NYC" request and vice versa.
    const cached = getCachedResearch(destination, userIntent);
    let researchResult: Awaited<ReturnType<typeof runResearchAgent>>;

    if (cached) {
      researchResult = {
        result: cached.result,
        thoughts: [...cached.thoughts, '⚡ Loaded from cache'],
      };
    } else {
      researchResult = await runResearchAgent({
        destination,
        preferences,
        userIntent,
        rawPrompt,
      });
      // Only cache if we actually got data — empty results are usually a
      // transient API failure and shouldn't poison future runs.
      const hasData =
        (researchResult.result.attractions?.length ?? 0) > 0 ||
        (researchResult.result.restaurants?.length ?? 0) > 0;
      if (hasData) {
        setCachedResearch(destination, researchResult.result, researchResult.thoughts, userIntent);
      }
    }

    // Pre-filter pool by user preferences (see agentic-orchestrator for rationale).
    researchResult = {
      ...researchResult,
      result: curateResearchByPreferences(researchResult.result, preferences, {}, userIntent),
    };

    state.research = researchResult.result;
    state.agents.researcher.thoughts = researchResult.thoughts;
    state.agents.researcher.status = 'complete';
    state.agents.researcher.progress = 100;
    log(state, 'researcher', 'Research complete', `Found ${researchResult.result.attractions.length} attractions, ${researchResult.result.restaurants.length} restaurants`);
    notify();

    // ========== PHASE 2: PLANNING WITH REVIEW LOOP ==========
    let currentPlan: ItineraryPlan | undefined;
    let approved = false;

    while (state.iteration < state.maxIterations && !approved) {
      state.iteration++;
      state.status = 'planning';
      state.agents.orchestrator.thoughts.push(`Iteration ${state.iteration}/${state.maxIterations}: ${state.iteration === 1 ? 'Initial planning' : 'Revising based on feedback'}`);
      log(state, 'orchestrator', 'Starting planning phase', `Iteration ${state.iteration}`);
      notify();

      // Run Planner Agent
      state.agents.planner.status = 'executing';
      state.agents.planner.currentTask = state.iteration === 1 ? 'Creating day-by-day itinerary' : 'Revising itinerary based on feedback';
      state.agents.planner.progress = 20;
      notify();

      const planResult = await runPlannerAgent({
        research: state.research,
        preferences,
        startDate,
        endDate,
        previousPlan: currentPlan,
        feedback: state.review?.issues,
        userIntent,
        rawPrompt,
      });

      currentPlan = planResult.plan;
      state.plan = currentPlan;
      state.agents.planner.thoughts = planResult.thoughts;
      state.agents.planner.status = 'complete';
      state.agents.planner.progress = 100;
      log(state, 'planner', 'Plan created', `${currentPlan.days.length} days planned`);
      notify();

      // Run Reviewer Agent
      state.status = 'reviewing';
      state.agents.reviewer.status = 'executing';
      state.agents.reviewer.currentTask = 'Evaluating itinerary quality';
      state.agents.reviewer.progress = 30;
      notify();

      const reviewResult = await runReviewerAgent({
        plan: currentPlan,
        preferences,
        research: state.research,
        userIntent,
        rawPrompt,
      });

      state.review = reviewResult.review;
      state.agents.reviewer.thoughts = reviewResult.thoughts;
      state.agents.reviewer.status = 'complete';
      state.agents.reviewer.progress = 100;
      log(state, 'reviewer', 'Review complete', `Score: ${reviewResult.review.score}/100, Issues: ${reviewResult.review.issues.length}`);
      notify();

      approved = reviewResult.review.approved;

      if (approved) {
        state.agents.orchestrator.thoughts.push(`✓ Plan approved! Score: ${reviewResult.review.score}/100`);
        log(state, 'orchestrator', 'Plan approved');
      } else {
        state.agents.orchestrator.thoughts.push(`✗ Plan needs revision (Score: ${reviewResult.review.score}/100)`);
        state.agents.orchestrator.thoughts.push(`Issues found: ${reviewResult.review.issues.map(i => i.issue).join(', ')}`);
        log(state, 'orchestrator', 'Plan rejected, will revise');
        
        // Use revised plan if reviewer provided one
        if (reviewResult.review.revisedPlan) {
          currentPlan = reviewResult.review.revisedPlan;
          state.agents.orchestrator.thoughts.push('Using reviewer-suggested revision');
        }
      }
      notify();
    }

    // ========== FINALIZE ==========
    state.status = 'complete';
    state.finalPlan = currentPlan;
    state.agents.orchestrator.status = 'complete';
    state.agents.orchestrator.progress = 100;
    
    if (approved) {
      state.agents.orchestrator.thoughts.push(`🎉 Successfully created ${currentPlan?.days.length}-day itinerary for ${destination}`);
      log(state, 'orchestrator', 'Orchestration complete', 'Success');
    } else {
      state.agents.orchestrator.thoughts.push(`⚠️ Completed with best effort after ${state.iteration} iterations`);
      log(state, 'orchestrator', 'Orchestration complete', 'Best effort');
    }
    notify();

    return {
      success: true,
      plan: state.finalPlan,
      research: state.research,
      state,
    };

  } catch (error) {
    state.status = 'error';
    state.agents.orchestrator.status = 'error';
    state.agents.orchestrator.thoughts.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    log(state, 'orchestrator', 'Error', error instanceof Error ? error.message : 'Unknown error');
    notify();

    return {
      success: false,
      state,
      error: error instanceof Error ? error.message : 'Orchestration failed',
    };
  }
}

/**
 * Get a summary of the orchestration for display
 */
export function getOrchestrationSummary(state: OrchestrationState): string {
  const lines: string[] = [];
  
  lines.push(`Status: ${state.status}`);
  lines.push(`Iteration: ${state.iteration}/${state.maxIterations}`);
  lines.push('');
  lines.push('Agent Activity:');
  
  for (const [role, agentState] of Object.entries(state.agents)) {
    if (agentState.thoughts.length > 0) {
      lines.push(`\n[${role.toUpperCase()}]`);
      agentState.thoughts.forEach(t => lines.push(`  • ${t}`));
    }
  }

  return lines.join('\n');
}
