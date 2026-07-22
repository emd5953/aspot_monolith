/**
 * Reviewer Agent
 *
 * Quality assurance: scores an itinerary, flags issues, and (when a plan is
 * rejected) produces a revised plan that addresses the high-severity issues.
 *
 * Both LLM calls use `generateObject` with Zod schemas, so there's no regex
 * extraction, no JSON-parse try/catch, and no "fallback review" branch —
 * those existed only to survive the unstructured generateText path. If the
 * model genuinely errors, the orchestrator handles the thrown error.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ReviewRequest, ReviewResult, ReviewIssue, ItineraryPlan } from './types';
import {
  ReviewSchema,
  ItineraryPlanSchema,
  normalizeSeverity,
  normalizeItemType,
  normalizeDuration,
} from '../schemas/plan';
import { auditPlan } from './plan-audit';

/**
 * Reviewer Agent — validates and improves itineraries.
 */
export async function runReviewerAgent(request: ReviewRequest): Promise<{
  review: ReviewResult;
  thoughts: string[];
}> {
  const {
    plan,
    preferences,
    research,
    userIntent,
    rawPrompt,
    autoRevise = false,
  } = request;
  const thoughts: string[] = [];

  thoughts.push(
    `Reviewing ${plan.days.length}-day itinerary for ${plan.destination}`
  );
  if (userIntent) {
    thoughts.push(`🎯 Scoring against user focus: "${userIntent}"`);
  }

  const intentBlock = userIntent
    ? `\n🎯 USER'S CORE FOCUS (PRIMARY EVALUATION CRITERION):\nUser said: "${rawPrompt ?? userIntent}"\nFocus: "${userIntent}"\nA plan that doesn't visibly serve this focus FAILS the review even if everything else is fine. Each day should contain at least one item that obviously serves this focus.\n`
    : '';

  // Mechanical checks run first, in code. The model is told what they found so
  // it doesn't have to (and demonstrably can't) do this arithmetic itself.
  const audit = auditPlan(plan, research);
  thoughts.push(
    `🔍 Automated audit: ${audit.findings.length} finding(s), score ceiling ${audit.scoreCeiling}/100 ` +
      `(max day spread ${audit.stats.maxDaySpreadKm}km, ${audit.stats.offPoolItems}/${audit.stats.totalItems} items off-pool)`
  );

  const auditBlock = `\n🤖 AUTOMATED CHECKS (already computed — treat as ground truth, do not re-derive or dispute):
${audit.summary}
${
  audit.scoreCeiling < 100
    ? `\nBecause of the above, this plan CANNOT score above ${audit.scoreCeiling}/100. Score at or below that ceiling and focus your own analysis on what the automated checks cannot see: whether the plan is actually good, interesting, and true to what the user asked for.`
    : '\nThe mechanical checks are clean. Judge the plan on quality, interest, and fit.'
}\n`;

  const reviewPrompt = `You are a meticulous travel itinerary reviewer. Analyze this itinerary for quality, feasibility, and alignment with user preferences.
${intentBlock}${auditBlock}
ITINERARY TO REVIEW:
${JSON.stringify(plan, null, 2)}

USER PREFERENCES:
- Budget: ${preferences.budgetRange || 'moderate'}
- Travel pace: ${preferences.travelPace || 'moderate'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Cuisines: ${preferences.cuisinePreferences?.join(', ') || 'local cuisine'}
- Comfort zone: ${preferences.comfortZone || 5}/10

AVAILABLE OPTIONS NOT USED:
Attractions: ${research.attractions
    .filter(
      (a) =>
        !plan.days.some((d) =>
          [...d.morning, ...d.afternoon, ...d.evening].some((i) =>
            i.name.includes(a.name)
          )
        )
    )
    .map((a) => a.name)
    .join(', ')}
Restaurants: ${research.restaurants
    .filter(
      (r) =>
        !plan.days.some((d) =>
          [...d.morning, ...d.afternoon, ...d.evening].some((i) =>
            i.name.includes(r.name)
          )
        )
    )
    .map((r) => r.name)
    .join(', ')}

CHECK FOR:
${userIntent ? `0. ⚠️ FOCUS ALIGNMENT (most important): does each day clearly serve "${userIntent}"? If not, raise a HIGH severity issue.` : ''}
1. Preference alignment — do activities match user interests?
2. Budget alignment — choices within budget?
3. Pace — too rushed or too slow?
4. Logical flow — locations grouped sensibly?
5. Time conflicts — overlapping activities?
6. Missing meals — lunch and dinner each day?
7. Variety — good mix of activity types?
8. Day 1 — lighter for arrival?
9. Adventure level — matches tolerance?
10. Dietary/accessibility considerations.

Score 0-100. Approve only if the plan is genuinely good (and, when a focus is
given, clearly serves it).`;

  thoughts.push('Analyzing itinerary quality...');

  const { object: parsed } = await generateObject({
    model: openai('gpt-4o'),
    schema: ReviewSchema,
    prompt: reviewPrompt,
    temperature: 0.3,
    // Schema has optional fields (e.g. issue.dayNumber); relax OpenAI strict
    // structured outputs. Zod still validates the response client-side.
    providerOptions: { openai: { strictJsonSchema: false } },
  });

  // The audit's findings are facts, so they lead; the model's follow. The
  // ceiling itself is applied to the score below, not carried on each issue.
  const auditIssues: ReviewIssue[] = audit.findings.map((f) => ({
    severity: f.severity,
    dayNumber: f.dayNumber,
    issue: f.issue,
    suggestion: f.suggestion,
  }));
  const modelIssues: ReviewIssue[] = parsed.issues.map((issue) => ({
    severity: normalizeSeverity(issue.severity),
    dayNumber: issue.dayNumber,
    issue: issue.issue,
    suggestion: issue.suggestion,
  }));
  const issues: ReviewIssue[] = [...auditIssues, ...modelIssues];

  // A model score above the ceiling is overruled — this is the whole point of
  // auditing first. Without it the reviewer awarded 92/100 to a plan that
  // booked one venue twice, the orchestrator saw its threshold met, and deep
  // mode's revise loop exited after a single iteration.
  const rawScore = Math.min(Math.max(Math.round(parsed.score ?? 0), 0), 100);
  const score = Math.min(rawScore, audit.scoreCeiling);
  if (score < rawScore) {
    thoughts.push(
      `⬇️ Model scored ${rawScore}; automated findings cap it at ${score}.`
    );
  }

  const highIssues = issues.filter((i) => i.severity === 'high').length;
  const mediumIssues = issues.filter((i) => i.severity === 'medium').length;

  thoughts.push(
    `Found ${issues.length} issues: ${highIssues} high, ${mediumIssues} medium`
  );
  thoughts.push(`Score: ${score}/100`);

  // Auto-approve when score is strong and nothing critical is open. We respect
  // the model's explicit `approved` too, but never approve over a high-severity
  // issue — from the audit or the model.
  const approved = highIssues === 0 && (parsed.approved || score >= 70);

  thoughts.push(approved ? '✓ Itinerary approved!' : '✗ Itinerary needs revision');

  const review: ReviewResult = {
    approved,
    score,
    issues,
    suggestions: parsed.suggestions,
  };

  // Rejected with critical issues → attempt a surgical revision.
  //
  // Off by default. A revision is a full-plan `generateObject` call on gpt-4o
  // and is only ever *used* when the orchestrator decides to stop; on every
  // other iteration the planner re-plans from the issues instead and the
  // revision is discarded. Producing one per iteration roughly quadrupled deep
  // mode's wall clock for output nobody read. The orchestrator now asks for it
  // explicitly, once, at the point it actually needs one.
  if (autoRevise && !approved && highIssues > 0) {
    thoughts.push('Generating revised plan...');
    const revisedPlan = await reviseItineraryPlan(plan, issues, preferences);
    if (revisedPlan) {
      review.revisedPlan = revisedPlan;
      thoughts.push('Created revised plan addressing issues');
    }
  }

  return { review, thoughts };
}

/**
 * Produce a corrected plan that fixes the flagged issues. Returns undefined
 * if the model call fails — the caller keeps the original plan in that case.
 *
 * Exported so the orchestrator can request a revision at the single moment one
 * is useful (the iteration it decides to stop on) rather than paying for one
 * every round. Callers must run the result through `removeCrossDayDuplicates`
 * before shipping it — it comes straight from a model and has not been through
 * any of the planner's post-processing.
 */
export async function reviseItineraryPlan(
  originalPlan: ItineraryPlan,
  issues: ReviewIssue[],
  preferences: { activityTypes: string[]; budgetRange: string; travelPace: string }
): Promise<ItineraryPlan | undefined> {
  const revisionPrompt = `Revise this itinerary to fix the identified issues.

ORIGINAL PLAN:
${JSON.stringify(originalPlan, null, 2)}

ISSUES TO FIX:
${issues
  .map(
    (i) =>
      `- [${i.severity}] Day ${i.dayNumber || 'General'}: ${i.issue} → ${i.suggestion}`
  )
  .join('\n')}

USER PREFERENCES:
- Budget: ${preferences.budgetRange || 'moderate'}
- Pace: ${preferences.travelPace || 'moderate'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}

Address all high and medium severity issues. Keep everything that already
works — change only what the issues call for.`;

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: ItineraryPlanSchema,
      prompt: revisionPrompt,
      temperature: 0.5,
      providerOptions: { openai: { strictJsonSchema: false } },
    });

    // The wire schema is permissive on item `type`/`duration` (see
    // schemas/plan.ts), so coerce them onto the pipeline's contract here.
    const normalizeItems = (
      items: (typeof object.days)[number]['morning']
    ): ItineraryPlan['days'][number]['morning'] =>
      (items ?? [])
        .filter((item) => typeof item?.name === 'string' && item.name.trim().length > 1)
        .map((item) => ({
          ...item,
          name: item.name.trim(),
          type: normalizeItemType(item.type),
          duration: normalizeDuration(item.duration),
          source: undefined,
        }));

    // The schema omits `destination` (the planner doesn't echo it back), so
    // carry it over from the original plan.
    return {
      destination: originalPlan.destination,
      summary: object.summary,
      days: object.days.map((day, index) => ({
        dayNumber: day.dayNumber || index + 1,
        date: day.date,
        theme: day.theme,
        morning: normalizeItems(day.morning),
        afternoon: normalizeItems(day.afternoon),
        evening: normalizeItems(day.evening),
        notes: day.notes ?? '',
        estimatedCost: day.estimatedCost ?? 'Varies',
      })),
      totalEstimatedCost: object.totalEstimatedCost ?? 'Varies',
      packingTips: object.packingTips ?? [],
      importantNotes: object.importantNotes ?? [],
    };
  } catch (error) {
    console.error('Revision failed:', error);
    return undefined;
  }
}
