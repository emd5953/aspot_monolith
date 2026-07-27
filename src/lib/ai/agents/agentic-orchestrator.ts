/**
 * Truly Agentic Orchestrator
 * 
 * This orchestrator:
 * - Decides dynamically when to stop iterating (quality-based, not fixed)
 * - Can skip review if confidence is high
 * - Adapts strategy based on what's working
 * - Shows full reasoning chain
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { UserPreferences } from '@/types/quiz';
import { OrchestrationState, ItineraryPlan, ResearchResult, ReviewIssue } from './types';
import { runAgenticResearcher } from './agentic-researcher';
import { runAgenticPlanner, removeCrossDayDuplicates } from './agentic-planner';
import { runReviewerAgent, reviseItineraryPlan } from './reviewer';
import { auditPlan } from './plan-audit';
import { repairPlan } from './plan-repair';
import { getCachedResearch, setCachedResearch } from '../research-cache';
import { curateResearchByPreferences } from '@/lib/preferences/score-research';

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
  /** Free-text user focus extracted from the original prompt. Optional. */
  userIntent?: string;
  /** Original prompt verbatim. Optional. */
  rawPrompt?: string;
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

// ─── Orchestrator decision: continue / stop / research_more / revise ─────────

export const OrchestratorActionSchema = z.object({
  action: z.enum(['continue', 'stop', 'research_more', 'revise']),
  reasoning: z.string().describe('One sentence justifying the action.'),
});

export type OrchestratorDecision = z.infer<typeof OrchestratorActionSchema>;

export interface DecisionContext {
  currentScore: number;
  iteration: number;
  maxIterations: number;
  qualityThreshold: number;
  issues: Array<{ severity: string; issue: string }>;
}

/** A function that picks the next action — real model, or injected in tests. */
export type ActionDecider = (ctx: DecisionContext) => Promise<OrchestratorDecision>;

/**
 * Rule-based decision — kept as the fallback when the LLM call is unavailable
 * or errors. This is the original heuristic, extracted verbatim so behavior is
 * unchanged when we fall back.
 */
export function decideNextActionRuleBased(ctx: DecisionContext): OrchestratorDecision {
  const { currentScore, iteration, maxIterations, qualityThreshold, issues } = ctx;

  if (currentScore >= qualityThreshold) {
    return { action: 'stop', reasoning: `Quality threshold met (${currentScore}/${qualityThreshold})` };
  }
  if (iteration >= maxIterations) {
    return { action: 'stop', reasoning: `Max iterations reached (${iteration}/${maxIterations})` };
  }
  if (currentScore >= 60 && iteration >= 1) {
    return {
      action: 'stop',
      reasoning: `Acceptable score (${currentScore}) after ${iteration} iteration - stopping for speed`,
    };
  }
  if (currentScore >= 65 && iteration >= 1) {
    return { action: 'stop', reasoning: `Good enough score (${currentScore}) after ${iteration} iteration(s)` };
  }
  if (currentScore >= 70 && iteration >= 2) {
    return { action: 'stop', reasoning: `Good enough score (${currentScore}) after ${iteration} iterations` };
  }

  const highSeverityIssues = issues.filter((i) => i.severity === 'high').length;
  if (highSeverityIssues > 3) {
    return { action: 'research_more', reasoning: `Too many critical issues (${highSeverityIssues}), need more data` };
  }
  if (currentScore < 60) {
    return { action: 'revise', reasoning: `Score too low (${currentScore}), major revision needed` };
  }
  return { action: 'continue', reasoning: `Score ${currentScore} is acceptable but can improve` };
}

/**
 * LLM decider: let the model reason over the current score and the open issues
 * and choose the next move. `generateObject` + the Zod schema guarantee a
 * well-shaped decision (no regex parsing). This is the primary path.
 */
async function decideNextActionWithLLM(ctx: DecisionContext): Promise<OrchestratorDecision> {
  const issueList =
    ctx.issues.length > 0
      ? ctx.issues.map((i) => `- [${i.severity}] ${i.issue}`).join('\n')
      : '(none reported)';

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: OrchestratorActionSchema,
    system: `You are the orchestrator of a multi-agent travel-itinerary builder. After each review you decide the next move:
- "stop": the plan is good enough to ship.
- "revise": the planner should rework the plan to address the issues.
- "research_more": the issues are about missing/weak options — gather more candidates before replanning.
- "continue": iterate once more without a specific corrective focus.
Optimize for a genuinely good itinerary while respecting that each iteration costs time and money. Prefer "stop" once quality is clearly acceptable.`,
    prompt: `Current quality score: ${ctx.currentScore}/100 (target ${ctx.qualityThreshold}).
Iteration ${ctx.iteration} of at most ${ctx.maxIterations}.
Open issues:
${issueList}

Choose the next action and justify it in one sentence.`,
    temperature: 0.2,
    providerOptions: { openai: { strictJsonSchema: false } },
  });

  return object;
}

/**
 * Decide the orchestrator's next action.
 *
 * Hard guards run first (deterministic, no spend): once the quality threshold
 * is met or the iteration ceiling is hit, we stop — never letting a model talk
 * us into an unbounded, costly loop. Otherwise the LLM reasons over score +
 * issues; if that call fails for any reason we fall back to the rule-based
 * heuristic so generation never breaks on a flaky model call.
 *
 * `decide` is injectable so the control flow can be unit-tested without a
 * paid model call.
 */
export async function decideNextAction(
  ctx: DecisionContext,
  decide: ActionDecider = decideNextActionWithLLM
): Promise<OrchestratorDecision> {
  if (ctx.currentScore >= ctx.qualityThreshold) {
    return { action: 'stop', reasoning: `Quality threshold met (${ctx.currentScore}/${ctx.qualityThreshold})` };
  }
  if (ctx.iteration >= ctx.maxIterations) {
    return { action: 'stop', reasoning: `Max iterations reached (${ctx.iteration}/${ctx.maxIterations})` };
  }

  try {
    return await decide(ctx);
  } catch (err) {
    console.warn('[agentic-orchestrator] LLM decision failed, using rule-based fallback:', err);
    return decideNextActionRuleBased(ctx);
  }
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
    userIntent,
    rawPrompt,
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
  // Check cache first — saves 30s-10min on repeat destinations.
  // Cache is keyed by destination + userIntent so an "R&B bars" pool isn't
  // served to a generic "NYC" request and vice versa.
  const cached = getCachedResearch(destination, userIntent);
  let researchResult: Awaited<ReturnType<typeof runAgenticResearcher>>;

  if (cached) {
    researchResult = {
      result: cached.result,
      thoughts: cached.thoughts,
      reasoningSteps: [{ thought: 'Using cached research', action: 'cache-hit', result: 'Loaded from file cache' }],
    };
    allThoughts.push(`⚡ Using cached research for "${destination}"${userIntent ? ` + "${userIntent}"` : ''} — skipping scraping`);
  } else {
    researchResult = await runAgenticResearcher({
      destination,
      preferences,
      useAdvancedMode: useAdvancedCuration,
      userIntent,
      rawPrompt,
      startDate,
      endDate,
    });
    // Only cache real results — don't poison future runs with empty research
    // from a transient Tavily failure.
    const hasData =
      (researchResult.result.attractions?.length ?? 0) > 0 ||
      (researchResult.result.restaurants?.length ?? 0) > 0;
    if (hasData) {
      setCachedResearch(destination, researchResult.result, researchResult.thoughts, userIntent);
    }
  }

  // Pre-filter the pool by user preferences AND user intent before the planner
  // sees it. This is what makes output feel curated rather than generic —
  // instead of hoping gpt-4o-mini will honor "match user prefs" instructions,
  // we rank candidates against prefs + intent keywords and keep only the top.
  // Limits scale with trip length: the pool is partitioned into disjoint
  // per-day slices downstream, so a 5-day trip needs a much deeper pool than
  // a weekend.
  const tripDays =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const beforeAttractions = researchResult.result.attractions.length;
  const beforeRestaurants = researchResult.result.restaurants.length;
  researchResult = {
    ...researchResult,
    result: curateResearchByPreferences(
      researchResult.result,
      preferences,
      {
        attractionLimit: Math.max(12, tripDays * 4),
        restaurantLimit: Math.max(10, tripDays * 3),
        activityLimit: Math.max(8, tripDays * 2),
      },
      userIntent
    ),
  };
  allThoughts.push(
    `🎯 Curated to user prefs${userIntent ? ` + intent ("${userIntent}")` : ''}: ${beforeAttractions}→${researchResult.result.attractions.length} attractions, ${beforeRestaurants}→${researchResult.result.restaurants.length} restaurants`
  );

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
  let reviewIssues: ReviewIssue[] = [];

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

    const planStart = Date.now();
    const planResult = await runAgenticPlanner({
      research: researchResult.result,
      preferences,
      startDate,
      endDate,
      userIntent,
      rawPrompt,
      // On iteration 2+ this carries the previous review's findings, so the
      // re-plan addresses them instead of re-rolling blind.
      reviewIssues,
    });

    // Mechanical repair, before the model ever sees the plan.
    //
    // This is where the audit's findings get *fixed* rather than merely
    // reported. It matters most in fast mode, which is the default path:
    // `maxIterations = 1` means `decideNextAction` returns "stop" on the first
    // pass before any reasoning happens, so the score ceiling can cap a flawed
    // plan but nothing ever acts on it. Repairing here raises the floor on
    // every generation for zero model spend and no extra latency.
    //
    // It also runs before review on purpose: the reviewer then scores the plan
    // that actually ships, and spends its issue budget on taste instead of
    // re-reporting a backwards clock we already straightened.
    const repaired = repairPlan(
      planResult.plan,
      researchResult.result,
      planResult.pools
    );
    currentPlan = repaired.plan;
    if (repaired.repairs.length > 0) {
      allThoughts.push(`🔧 Deterministic repair applied ${repaired.repairs.length} fix(es):`);
      repaired.repairs.forEach((r) => allThoughts.push(`  • ${r}`));
      allReasoning.push({
        agent: 'orchestrator',
        thought: 'Mechanical defects have known fixes — apply them in code, not via the model',
        action: 'Running deterministic plan repair',
        result: `${repaired.repairs.length} fix(es) applied`,
        timestamp: new Date(),
      });
    } else {
      allThoughts.push('🔧 Deterministic repair: nothing to fix.');
    }

    console.log(
      `[agentic-orchestrator] iteration ${iteration}: planning took ${((Date.now() - planStart) / 1000).toFixed(1)}s`
    );
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

    const reviewStart = Date.now();
    const reviewResult = await runReviewerAgent({
      plan: currentPlan,
      preferences,
      research: researchResult.result,
      userIntent,
      rawPrompt,
    });
    console.log(
      `[agentic-orchestrator] iteration ${iteration}: review took ${((Date.now() - reviewStart) / 1000).toFixed(1)}s`
    );

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

    const decision = await decideNextAction({
      currentScore,
      iteration,
      maxIterations,
      qualityThreshold,
      issues: reviewIssues,
    });

    decisionStep.result = `Decision: ${decision.action} - ${decision.reasoning}`;
    allReasoning.push(decisionStep);
    allThoughts.push('');
    allThoughts.push(`DECISION: ${decision.reasoning}`);

    if (decision.action === 'stop') {
      // Last chance to fix a plan we know is flawed: ask the reviewer for a
      // corrected version, here and only here, because this is the one
      // iteration whose plan actually ships.
      //
      // But the revision comes straight out of a model and never passed
      // through the planner's post-processing, so it has to earn the swap:
      // dedupe it first (an adopted revision used to silently re-introduce
      // duplicate venues the planner had already stripped), then adopt it only
      // if the audit says it's genuinely no worse than what we already have.
      const needsRevision =
        !reviewResult.review.approved &&
        reviewIssues.some((i) => i.severity === 'high');
      const reviseStart = Date.now();
      const revised = needsRevision
        ? await reviseItineraryPlan(currentPlan, reviewIssues, preferences)
        : undefined;
      if (needsRevision) {
        console.log(
          `[agentic-orchestrator] revision took ${((Date.now() - reviseStart) / 1000).toFixed(1)}s`
        );
      }

      if (revised) {
        // Re-stamp the calendar from the plan we already trust. The revision's
        // `date`/`dayNumber` are raw model output that nothing overwrites on
        // this path (the planner path stamps its own), and an unparseable date
        // reaches `new Date(day.date)` at persist time and fails the whole
        // generation after every model call has already been paid for.
        const byIndex = currentPlan.days;
        const restamped: ItineraryPlan = {
          ...revised,
          days: removeCrossDayDuplicates(revised.days).days.map((day, i) => ({
            ...day,
            dayNumber: byIndex[i]?.dayNumber ?? i + 1,
            date: byIndex[i]?.date ?? day.date,
          })),
        };
        // Repair the revision too, so the comparison below is like-for-like:
        // `currentPlan` has already been through repair, and a revision judged
        // against it unrepaired would lose on defects we know how to fix. The
        // date re-stamp must come first — repair reads `day.date` to decide
        // what is open.
        const cleaned = repairPlan(restamped, researchResult.result, planResult.pools).plan;
        const beforeCeiling = auditPlan(currentPlan, researchResult.result).scoreCeiling;
        const afterCeiling = auditPlan(cleaned, researchResult.result).scoreCeiling;

        // The ceiling is a min over findings, so it goes *up* when the plan
        // holds less: a revision that quietly drops two days audits clean and
        // would otherwise always win. Coverage is not negotiable — a shorter
        // trip than the user asked for is never an improvement.
        const countItems = (p: ItineraryPlan) =>
          p.days.reduce(
            (n, d) =>
              n + (d.morning?.length ?? 0) + (d.afternoon?.length ?? 0) + (d.evening?.length ?? 0),
            0
          );
        const keptCoverage =
          cleaned.days.length === currentPlan.days.length &&
          countItems(cleaned) >= countItems(currentPlan) * 0.8;

        if (!keptCoverage) {
          allThoughts.push(
            `Keeping the original plan — the revision drops coverage (${currentPlan.days.length} days/${countItems(currentPlan)} items → ${cleaned.days.length}/${countItems(cleaned)})`
          );
        } else if (afterCeiling >= beforeCeiling) {
          currentPlan = cleaned;
          allThoughts.push(
            `Adopting reviewer's revised plan (audit ceiling ${beforeCeiling} → ${afterCeiling})`
          );
        } else {
          allThoughts.push(
            `Keeping the original plan — the reviewer's revision audits worse (${beforeCeiling} → ${afterCeiling})`
          );
        }
      }
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
