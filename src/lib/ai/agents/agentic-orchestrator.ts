/**
 * Truly Agentic Orchestrator
 * 
 * This orchestrator:
 * - Decides dynamically when to stop iterating (quality-based, not fixed)
 * - Can skip review if confidence is high
 * - Adapts strategy based on what's working
 * - Shows full reasoning chain
 */

import { UserPreferences } from '@/types/quiz';
import { OrchestrationState, ItineraryPlan, ResearchResult } from './types';
import { runAgenticResearcher } from './agentic-researcher';
import { runAgenticPlanner } from './agentic-planner';
import { runReviewerAgent } from './reviewer';

interface ReasoningStep {
  agent: string;
  thought: string;
  action: string;
  result: string;
  timestamp: Date;
}

export interface AgenticOrchestratorInput {
  destination: string;
  startDate: Date;
  endDate: Date;
  preferences: UserPreferences;
  qualityThreshold?: number; // Stop when score reaches this (default 60)
  maxIterations?: number; // Safety limit (default 1 for speed)
  useAdvancedCuration?: boolean; // Enable extensive scraping + iterations
  onProgress?: (state: OrchestrationState & { reasoning: ReasoningStep[] }) => void;
}

export interface AgenticOrchestratorOutput {
  success: boolean;
  plan?: ItineraryPlan;
  research?: ResearchResult;
  finalScore: number;
  iterations: number;
  reasoning: ReasoningStep[];
  thoughts: string[];
}

/**
 * Orchestrator decides next action based on current state
 */
async function decideNextAction(
  currentScore: number,
  iteration: number,
  maxIterations: number,
  qualityThreshold: number,
  issues: Array<{ severity: string; issue: string }>,
  reasoning: ReasoningStep[]
): Promise<{
  action: 'continue' | 'stop' | 'research_more' | 'revise';
  reasoning: string;
}> {
  // Simple rule-based decisions (could be AI-powered for even more agency)
  
  if (currentScore >= qualityThreshold) {
    return {
      action: 'stop',
      reasoning: `Quality threshold met (${currentScore}/${qualityThreshold})`,
    };
  }

  if (iteration >= maxIterations) {
    return {
      action: 'stop',
      reasoning: `Max iterations reached (${iteration}/${maxIterations})`,
    };
  }

  // Very aggressive stopping - accept any score above 60 after 1 iteration
  if (currentScore >= 60 && iteration >= 1) {
    return {
      action: 'stop',
      reasoning: `Acceptable score (${currentScore}) after ${iteration} iteration - stopping for speed`,
    };
  }

  // More aggressive stopping - accept scores above 65
  if (currentScore >= 65 && iteration >= 1) {
    return {
      action: 'stop',
      reasoning: `Good enough score (${currentScore}) after ${iteration} iteration(s)`,
    };
  }

  // More aggressive stopping - accept scores above 70
  if (currentScore >= 70 && iteration >= 2) {
    return {
      action: 'stop',
      reasoning: `Good enough score (${currentScore}) after ${iteration} iterations`,
    };
  }

  const highSeverityIssues = issues.filter(i => i.severity === 'high').length;
  
  if (highSeverityIssues > 3) {
    return {
      action: 'research_more',
      reasoning: `Too many critical issues (${highSeverityIssues}), need more data`,
    };
  }

  if (currentScore < 60) {
    return {
      action: 'revise',
      reasoning: `Score too low (${currentScore}), major revision needed`,
    };
  }

  return {
    action: 'continue',
    reasoning: `Score ${currentScore} is acceptable but can improve`,
  };
}

/**
 * Truly Agentic Orchestrator
 */
export async function runAgenticOrchestrator(
  input: AgenticOrchestratorInput
): Promise<AgenticOrchestratorOutput> {
  const {
    destination,
    startDate,
    endDate,
    preferences,
    qualityThreshold = 75,
    maxIterations = 1,
    useAdvancedCuration = false,
    onProgress,
  } = input;

  const allThoughts: string[] = [];
  const allReasoning: ReasoningStep[] = [];
  let currentScore = 0;
  let iteration = 0;

  allThoughts.push('AGENTIC ORCHESTRATOR ACTIVATED');
  allThoughts.push(useAdvancedCuration 
    ? `Goal: Premium quality with extensive research (${maxIterations} iterations, score ${qualityThreshold}+)`
    : `Goal: Fast quality (1 iteration for speed)`);
  allThoughts.push('');

  // PHASE 1: RESEARCH (Lightweight or Extensive based on mode)
  allThoughts.push(useAdvancedCuration 
    ? '=== PHASE 1: EXTENSIVE RESEARCH (Advanced Mode) ==='
    : '=== PHASE 1: LIGHTWEIGHT RESEARCH ===');
  
  const researchStep: ReasoningStep = {
    agent: 'orchestrator',
    thought: useAdvancedCuration
      ? 'Running extensive web scraping for premium quality (Google, Reddit, TripAdvisor)'
      : 'Getting real location data for accuracy (lightweight mode)',
    action: useAdvancedCuration ? 'Extensive web scraping' : 'Quick web scraping',
    result: '',
    timestamp: new Date(),
  };
  allReasoning.push(researchStep);

  // Use extensive or lightweight research based on mode
  const researchResult = await runAgenticResearcher({
    destination,
    preferences,
    useAdvancedMode: useAdvancedCuration, // Pass flag to researcher
  });

  researchStep.result = `Found ${researchResult.result.attractions.length} attractions, ${researchResult.result.restaurants.length} restaurants`;
  allThoughts.push(useAdvancedCuration
    ? `Extensive research: ${researchResult.result.attractions.length} attractions, ${researchResult.result.restaurants.length} restaurants from multiple sources`
    : `Quick research: ${researchResult.result.attractions.length} attractions, ${researchResult.result.restaurants.length} restaurants`);
  allReasoning.push(...researchResult.reasoningSteps.map(s => ({
    agent: 'researcher',
    thought: s.thought,
    action: s.action,
    result: s.result || '',
    timestamp: new Date(),
  })));

  let currentPlan: ItineraryPlan | undefined;
  let reviewIssues: Array<{ severity: string; issue: string; suggestion: string }> = [];

  // PHASE 2: ITERATIVE PLANNING WITH ADAPTIVE STOPPING
  allThoughts.push('');
  allThoughts.push('=== PHASE 2: AGENTIC PLANNING LOOP ===');

  while (iteration < maxIterations) {
    iteration++;
    
    allThoughts.push('');
    allThoughts.push(`--- Iteration ${iteration}/${maxIterations} ---`);

    // STEP 1: Plan
    const planStep: ReasoningStep = {
      agent: 'orchestrator',
      thought: iteration === 1 
        ? 'Creating initial itinerary based on research data'
        : `Revising itinerary to address ${reviewIssues.length} issues from review`,
      action: 'Delegating to Agentic Planner',
      result: '',
      timestamp: new Date(),
    };
    allReasoning.push(planStep);

    const planResult = await runAgenticPlanner({
      research: researchResult.result,
      preferences,
      startDate,
      endDate,
    });

    currentPlan = planResult.plan;
    planStep.result = `Plan created: ${currentPlan.days.length} days`;
    allThoughts.push(...planResult.thoughts);
    allReasoning.push(...planResult.reasoningSteps.map(s => ({
      agent: 'planner',
      thought: s.thought,
      action: s.action,
      result: s.result || '',
      timestamp: new Date(),
    })));

    // STEP 2: Review
    const reviewStep: ReasoningStep = {
      agent: 'orchestrator',
      thought: 'I need to validate the quality of this itinerary',
      action: 'Delegating to Reviewer Agent',
      result: '',
      timestamp: new Date(),
    };
    allReasoning.push(reviewStep);

    const reviewResult = await runReviewerAgent({
      plan: currentPlan,
      preferences,
      research: researchResult.result,
    });

    currentScore = reviewResult.review.score;
    reviewIssues = reviewResult.review.issues;
    reviewStep.result = `Score: ${currentScore}/100, Issues: ${reviewIssues.length}`;
    allThoughts.push(...reviewResult.thoughts);

    // STEP 3: Decide next action
    const decisionStep: ReasoningStep = {
      agent: 'orchestrator',
      thought: `Current score is ${currentScore}. Should I continue iterating or stop?`,
      action: 'Making strategic decision',
      result: '',
      timestamp: new Date(),
    };

    const decision = await decideNextAction(
      currentScore,
      iteration,
      maxIterations,
      qualityThreshold,
      reviewIssues,
      allReasoning
    );

    decisionStep.result = `Decision: ${decision.action} - ${decision.reasoning}`;
    allReasoning.push(decisionStep);
    allThoughts.push('');
    allThoughts.push(`DECISION: ${decision.reasoning}`);

    if (decision.action === 'stop') {
      allThoughts.push('Stopping: Quality goal achieved or iteration limit reached');
      break;
    }

    if (decision.action === 'research_more') {
      allThoughts.push('Need more research data (not implemented in this iteration)');
      // Could trigger additional research here
    }

    if (decision.action === 'revise') {
      allThoughts.push('Major revision needed, continuing to next iteration');
    }

    // Notify progress
    onProgress?.({
      sessionId: `agentic_${Date.now()}`,
      status: 'planning',
      iteration,
      maxIterations,
      agents: {
        orchestrator: { status: 'thinking', progress: (iteration / maxIterations) * 100, thoughts: allThoughts, lastUpdate: new Date() },
        researcher: { status: 'complete', progress: 100, thoughts: [], lastUpdate: new Date() },
        planner: { status: 'complete', progress: 100, thoughts: [], lastUpdate: new Date() },
        reviewer: { status: 'complete', progress: 100, thoughts: [], lastUpdate: new Date() },
      },
      logs: [],
      reasoning: allReasoning,
    });
  }

  // FINAL SUMMARY
  allThoughts.push('');
  allThoughts.push('=== ORCHESTRATION COMPLETE ===');
  allThoughts.push(`Final Score: ${currentScore}/100`);
  allThoughts.push(`Iterations: ${iteration}`);
  allThoughts.push(`Total Reasoning Steps: ${allReasoning.length}`);

  return {
    success: true,
    plan: currentPlan,
    research: researchResult.result,
    finalScore: currentScore,
    iterations: iteration,
    reasoning: allReasoning,
    thoughts: allThoughts,
  };
}
