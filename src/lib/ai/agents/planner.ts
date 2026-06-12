/**
 * Planner Agent
 *
 * Specialized agent for creating day-by-day itineraries. Used in fast mode by
 * `runOrchestrator` — produces the *whole trip* in a single LLM call.
 *
 * Output shape is enforced by Zod schemas in `../schemas/plan.ts` via
 * `generateObject`. The model can't physically return malformed JSON, so this
 * file no longer contains regex extraction, try/catch JSON parsing, or a
 * "fallback plan" branch — those existed only to paper over the unstructured
 * generateText path.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PlanRequest, ItineraryPlan, DayPlan, ScheduledItem } from './types';
import { ItineraryPlanSchema } from '../schemas/plan';

/**
 * Planner Agent — creates structured itineraries.
 *
 * Returns a typed plan plus a `thoughts` array for the orchestrator's UI/logs.
 */
export async function runPlannerAgent(
  request: PlanRequest & {
    previousPlan?: ItineraryPlan;
    feedback?: Array<{ issue: string; suggestion: string }>;
  }
): Promise<{
  plan: ItineraryPlan;
  thoughts: string[];
}> {
  const {
    research,
    preferences,
    startDate,
    endDate,
    previousPlan,
    feedback,
    userIntent,
    rawPrompt,
  } = request;
  const thoughts: string[] = [];

  const tripDuration =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  thoughts.push(`Planning ${tripDuration}-day trip to ${research.destination}`);
  thoughts.push(
    `Available: ${research.attractions.length} attractions, ${research.restaurants.length} restaurants, ${research.activities.length} activities`
  );

  if (userIntent) {
    thoughts.push(`🎯 PRIMARY FOCUS: "${userIntent}"`);
  }

  if (previousPlan && feedback) {
    thoughts.push(`Revising previous plan based on ${feedback.length} issues`);
  }

  // Activities-per-day target by pace. Used as guidance in the prompt; the
  // schema doesn't enforce counts so the planner has some flexibility.
  const activitiesPerDay = ({
    relaxed: { morning: 1, afternoon: 1, evening: 1 },
    moderate: { morning: 1, afternoon: 2, evening: 1 },
    packed: { morning: 2, afternoon: 2, evening: 2 },
  } as const)[preferences.travelPace || 'moderate'] || {
    morning: 1,
    afternoon: 2,
    evening: 1,
  };

  thoughts.push(
    `Travel pace: ${preferences.travelPace} - planning ${
      activitiesPerDay.morning + activitiesPerDay.afternoon + activitiesPerDay.evening
    } activities per day`
  );

  // ── Prompt construction ────────────────────────────────────────────────
  // Notice this prompt no longer ends with "RESPOND WITH VALID JSON ..."
  // boilerplate — the schema does that work now.

  const revisionContext =
    previousPlan && feedback
      ? `
PREVIOUS PLAN (needs revision):
${JSON.stringify(previousPlan, null, 2)}

ISSUES TO FIX:
${feedback.map((f) => `- ${f.issue}: ${f.suggestion}`).join('\n')}

Create an IMPROVED version that addresses every issue above.
`
      : '';

  // The user's free-text focus is the most important signal we have. It came
  // straight from their prompt and beats any quiz preference when they
  // conflict. Surface it loudly so the model can't ignore it.
  const intentBlock = userIntent
    ? `
🎯 PRIMARY OBJECTIVE — THE USER'S OWN WORDS:
The user said: "${rawPrompt ?? userIntent}"
Their core focus for this trip: "${userIntent}"

Every day MUST clearly serve this focus. If you have to choose between an item
that matches this focus and one that matches their generic quiz preferences,
ALWAYS pick the one that matches the focus. The trip should feel like it was
built FOR this focus, not a generic trip with one or two themed stops.
`
    : '';

  const planningPrompt = `You are an expert travel planner creating a ${tripDuration}-day itinerary for ${research.destination}.

CRITICAL: every activity, attraction, and restaurant MUST be in ${research.destination}. Verify each one before including it.
${intentBlock}
${revisionContext}

AVAILABLE OPTIONS:
ATTRACTIONS:
${research.attractions
  .map(
    (a) =>
      `- ${a.name} (${a.category}, ${a.estimatedDuration}min, ${a.priceRange})${a.tips ? ` Tip: ${a.tips}` : ''}`
  )
  .join('\n')}

RESTAURANTS:
${research.restaurants
  .map(
    (r) =>
      `- ${r.name} (${r.cuisine.join('/')}, ${r.priceRange})${r.mustTry ? ` Must try: ${r.mustTry}` : ''}`
  )
  .join('\n')}

ACTIVITIES:
${research.activities
  .map(
    (a) =>
      `- ${a.name} (${a.category}, ${a.duration}min, adventure: ${a.adventureLevel}/10, best: ${a.bestTime || 'anytime'})`
  )
  .join('\n')}

USER PREFERENCES:
- Budget: ${preferences.budgetRange || 'moderate'}
- Pace: ${preferences.travelPace || 'moderate'} (target ${activitiesPerDay.morning} morning, ${activitiesPerDay.afternoon} afternoon, ${activitiesPerDay.evening} evening per day)
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Cuisines: ${preferences.cuisinePreferences?.join(', ') || 'local cuisine'}
- Comfort zone: ${preferences.comfortZone || 5}/10

LOCAL INSIGHTS:
${research.localInsights.map((i) => `- ${i}`).join('\n')}

RULES:
1. Use ONLY items from the AVAILABLE OPTIONS above. Don't invent places.
2. Every location must be in ${research.destination}.
3. Day 1 should be lighter (arrival).
4. Don't repeat the same item across days.
5. Don't repeat the same item within a single day.
6. Include lunch and dinner each day (use restaurant items).
7. Group nearby attractions in the same day.
8. Leave some breathing room — don't pack every minute.
9. Respect opening hours (museums earlier, nightlife later).
${userIntent ? `10. **OBJECTIVE LOCK**: the trip is FOR "${userIntent}". Each day must include AT LEAST ONE item that obviously serves this focus.` : ''}

The first day's date is ${startDate.toISOString().split('T')[0]}; the orchestrator
will recompute calendar dates for each day, so don't worry about getting them perfect.`;

  thoughts.push('Generating optimized itinerary...');
  const planStartTime = Date.now();

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: ItineraryPlanSchema,
    prompt: planningPrompt,
    temperature: 0.7,
  });

  console.log(
    `[TIMING] Planning AI call completed in ${((Date.now() - planStartTime) / 1000).toFixed(1)}s`
  );

  // ── Post-processing: deterministic, not LLM-driven ─────────────────────

  // 1. Stamp correct calendar dates and dayNumbers. The schema lets the
  //    model best-effort these, but we own the truth here.
  // 2. De-duplicate items inside each day.
  // 3. Pad days if the model returned fewer than tripDuration.
  const days: DayPlan[] = (object.days ?? []).map((day, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + index);

    const seen = new Set<string>();
    const dedupe = (items: ScheduledItem[]): ScheduledItem[] =>
      items.filter((item) => {
        if (!item.name) return false;
        const key = item.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return {
      dayNumber: day.dayNumber || index + 1,
      date: dayDate.toISOString().split('T')[0],
      theme: day.theme || `Day ${index + 1}`,
      morning: dedupe((day.morning ?? []) as ScheduledItem[]),
      afternoon: dedupe((day.afternoon ?? []) as ScheduledItem[]),
      evening: dedupe((day.evening ?? []) as ScheduledItem[]),
      notes: day.notes ?? '',
      estimatedCost: day.estimatedCost ?? 'Varies',
    };
  });

  // Pad missing days from the research pool — better than failing or
  // returning a short trip.
  while (days.length < tripDuration) {
    const idx = days.length;
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + idx);
    days.push(makeFallbackDay(idx + 1, dayDate, research));
  }

  const plan: ItineraryPlan = {
    destination: research.destination,
    summary:
      object.summary ||
      `${tripDuration}-day adventure in ${research.destination}`,
    days,
    totalEstimatedCost: object.totalEstimatedCost ?? 'Varies by choices',
    packingTips: object.packingTips ?? [],
    importantNotes: object.importantNotes ?? [],
  };

  thoughts.push(
    `Created ${days.length}-day itinerary with ${days.reduce(
      (sum, d) => sum + d.morning.length + d.afternoon.length + d.evening.length,
      0
    )} total activities`
  );
  thoughts.push('Planning complete!');

  return { plan, thoughts };
}

/**
 * Stub day used only when the model returned fewer days than the trip needs.
 * Pulls names from the research pool so we don't surface "Activity" placeholders.
 */
function makeFallbackDay(
  dayNumber: number,
  date: Date,
  research: {
    destination: string;
    attractions: { name: string }[];
    restaurants: { name: string }[];
  }
): DayPlan {
  return {
    dayNumber,
    date: date.toISOString().split('T')[0],
    theme: `Exploring ${research.destination}`,
    morning: [
      {
        time: '09:00',
        name: research.attractions[0]?.name || 'Morning exploration',
        type: 'attraction',
        duration: 120,
      },
    ],
    afternoon: [
      {
        time: '12:30',
        name: research.restaurants[0]?.name || 'Local lunch',
        type: 'restaurant',
        duration: 60,
      },
      { time: '14:00', name: 'Free time to explore', type: 'free_time', duration: 120 },
    ],
    evening: [
      {
        time: '19:00',
        name: research.restaurants[1]?.name || 'Dinner',
        type: 'restaurant',
        duration: 90,
      },
    ],
    notes: '',
    estimatedCost: 'Varies',
  };
}
