/**
 * Reviewer Agent
 * 
 * Specialized agent for quality assurance.
 * Reviews itineraries for issues and suggests improvements.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ReviewRequest, ReviewResult, ReviewIssue, ItineraryPlan } from './types';

/**
 * Reviewer Agent - validates and improves itineraries
 */
export async function runReviewerAgent(request: ReviewRequest): Promise<{
  review: ReviewResult;
  thoughts: string[];
}> {
  const { plan, preferences, research, userIntent, rawPrompt } = request;
  const thoughts: string[] = [];

  thoughts.push(`Reviewing ${plan.days.length}-day itinerary for ${plan.destination}`);
  if (userIntent) {
    thoughts.push(`🎯 Scoring against user focus: "${userIntent}"`);
  }

  // Build review prompt
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
Attractions: ${research.attractions.filter(a => !plan.days.some(d => [...d.morning, ...d.afternoon, ...d.evening].some(i => i.name.includes(a.name)))).map(a => a.name).join(', ')}
Restaurants: ${research.restaurants.filter(r => !plan.days.some(d => [...d.morning, ...d.afternoon, ...d.evening].some(i => i.name.includes(r.name)))).map(r => r.name).join(', ')}

CHECK FOR:
${userIntent ? `0. ⚠️ FOCUS ALIGNMENT (most important): does each day clearly serve "${userIntent}"? If not, raise a HIGH severity issue.` : ''}
1. Preference alignment - do activities match user interests?
2. Budget alignment - are choices within budget?
3. Pace appropriateness - too rushed or too slow?
4. Logical flow - are locations grouped sensibly?
5. Time conflicts - overlapping activities?
6. Missing meals - lunch and dinner each day?
7. Variety - good mix of activity types?
8. Day 1 consideration - is it lighter for arrival?
9. Adventure level match - activities match tolerance?
10. Dietary/accessibility considerations

RESPOND WITH VALID JSON:
{
  "approved": true/false,
  "score": 85,
  "issues": [
    {"severity": "high/medium/low", "dayNumber": 1, "issue": "Description", "suggestion": "How to fix"}
  ],
  "suggestions": ["General improvement suggestions"],
  "reasoning": "Overall assessment"
}`;

  try {
    thoughts.push('Analyzing itinerary quality...');

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: reviewPrompt,
      temperature: 0.3, // Lower temperature for more consistent reviews
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const issues: ReviewIssue[] = (parsed.issues || []).map((issue: Partial<ReviewIssue>) => ({
        severity: issue.severity || 'low',
        dayNumber: issue.dayNumber,
        issue: issue.issue || 'Unknown issue',
        suggestion: issue.suggestion || 'Review manually',
      }));

      const highIssues = issues.filter(i => i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'medium').length;

      thoughts.push(`Found ${issues.length} issues: ${highIssues} high, ${mediumIssues} medium`);
      thoughts.push(`Score: ${parsed.score || 0}/100`);

      // Auto-approve if score is high enough and no critical issues
      const approved = (parsed.score >= 70 && highIssues === 0) || parsed.approved;

      if (approved) {
        thoughts.push('✓ Itinerary approved!');
      } else {
        thoughts.push('✗ Itinerary needs revision');
      }

      const review: ReviewResult = {
        approved,
        score: parsed.score || 50,
        issues,
        suggestions: parsed.suggestions || [],
      };

      // If not approved, try to create a revised plan
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
  } catch (error) {
    thoughts.push(`Review error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fallback - approve with suggestions
  thoughts.push('Using fallback review...');
  return {
    review: {
      approved: true,
      score: 70,
      issues: [],
      suggestions: ['Consider checking opening hours', 'Book popular restaurants in advance'],
    },
    thoughts,
  };
}

async function generateRevisedPlan(
  originalPlan: ItineraryPlan,
  issues: ReviewIssue[],
  preferences: { activityTypes: string[]; budgetRange: string; travelPace: string }
): Promise<ItineraryPlan | undefined> {
  const revisionPrompt = `Revise this itinerary to fix the identified issues:

ORIGINAL PLAN:
${JSON.stringify(originalPlan, null, 2)}

ISSUES TO FIX:
${issues.map(i => `- [${i.severity}] Day ${i.dayNumber || 'General'}: ${i.issue} → ${i.suggestion}`).join('\n')}

USER PREFERENCES:
- Budget: ${preferences.budgetRange || 'moderate'}
- Pace: ${preferences.travelPace || 'moderate'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}

Create a revised version that addresses all high and medium severity issues.
Keep the same JSON structure as the original.
RESPOND ONLY WITH THE REVISED JSON.`;

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: revisionPrompt,
      temperature: 0.5,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ItineraryPlan;
    }
  } catch (error) {
    console.error('Revision failed:', error);
  }

  return undefined;
}
