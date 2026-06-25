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
import { ReviewSchema, ItineraryPlanSchema } from '../schemas/plan';

/**
 * Reviewer Agent — validates and improves itineraries.
 */
export async function runReviewerAgent(request: ReviewRequest): Promise<{
  review: ReviewResult;
  thoughts: string[];
}> {
  const { plan, preferences, research, userIntent, rawPrompt } = request;
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

  const reviewPrompt = `You are a meticulous travel itinerary reviewer. Analyze this itinerary for quality, feasibility, and alignment with user preferences.
${intentBlock}
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

  const issues: ReviewIssue[] = parsed.issues.map((issue) => ({
    severity: issue.severity,
    dayNumber: issue.dayNumber,
    issue: issue.issue,
    suggestion: issue.suggestion,
  }));

  const highIssues = issues.filter((i) => i.severity === 'high').length;
  const mediumIssues = issues.filter((i) => i.severity === 'medium').length;

  thoughts.push(
    `Found ${issues.length} issues: ${highIssues} high, ${mediumIssues} medium`
  );
  thoughts.push(`Score: ${parsed.score}/100`);

  // Auto-approve when score is strong and nothing critical is open. We respect
  // the model's explicit `approved` too, but never approve over a high-severity
  // issue.
  const approved =
    highIssues === 0 && (parsed.approved || parsed.score >= 70);

  thoughts.push(approved ? '✓ Itinerary approved!' : '✗ Itinerary needs revision');

  const review: ReviewResult = {
    approved,
    score: parsed.score,
    issues,
    suggestions: parsed.suggestions,
  };

  // Rejected with critical issues → attempt a surgical revision.
  if (!approved && highIssues > 0) {
    thoughts.push('Generating revised plan...');
    const revisedPlan = await generateRevisedPlan(plan, issues, preferences);
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
 */
async function generateRevisedPlan(
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

    // The schema omits `destination` (the planner doesn't echo it back), so
    // carry it over from the original plan.
    return {
      destination: originalPlan.destination,
      summary: object.summary,
      days: object.days.map((day, index) => ({
        dayNumber: day.dayNumber || index + 1,
        date: day.date,
        theme: day.theme,
        morning: day.morning ?? [],
        afternoon: day.afternoon ?? [],
        evening: day.evening ?? [],
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
