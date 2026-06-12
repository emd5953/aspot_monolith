/**
 * Truly Agentic Planner
 *
 * Used in deep mode by `runAgenticOrchestrator`. Two LLM calls:
 *
 *   1. **Strategy** — produces day themes + overall pacing/meal approach
 *      (one call, fast model).
 *   2. **Per-day build** — fills each day's morning/afternoon/evening with
 *      specific items from the curated research pool. Days run in parallel
 *      because they don't depend on each other once the strategy is set.
 *
 * Both calls use `generateObject` with Zod schemas in `../schemas/plan.ts`.
 * The model can't return a malformed shape, so this file no longer carries
 * regex extraction or JSON-parse fallbacks.
 *
 * Cross-day dedup happens after all per-day calls return — a deterministic
 * post-processing pass, not part of the LLM's job.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  PlanRequest,
  ItineraryPlan,
  DayPlan,
  ResearchResult,
} from './types';
import { UserPreferences } from '@/types/quiz';
import {
  PlanningStrategySchema,
  SingleDaySchema,
  type PlanningStrategySchemaT,
} from '../schemas/plan';

interface ReasoningStep {
  thought: string;
  action: string;
  result?: string;
}

// ─── Step 1: strategy ──────────────────────────────────────────────────────

/**
 * Produce a high-level approach (day themes + pacing + meal strategy) that
 * the per-day pass will fill in. One cheap LLM call.
 */
async function createPlanningStrategy(
  request: PlanRequest
): Promise<PlanningStrategySchemaT> {
  const { research, preferences, startDate, endDate, userIntent, rawPrompt } =
    request;

  const tripDays =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  const intentBlock = userIntent
    ? `\n🎯 USER'S CORE FOCUS (top priority — beats generic prefs when they conflict):\nUser said: "${rawPrompt ?? userIntent}"\nFocus: "${userIntent}"\nEvery day theme must clearly serve this focus.\n`
    : '';

  const strategyPrompt = `You are a strategic itinerary planner. Create a high-level strategy for a ${tripDays}-day trip to ${research.destination}.
${intentBlock}
USER PROFILE:
- Travel Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Planning Style: ${preferences.planningStyle || 'balanced'}
- Authenticity Preference: ${preferences.authenticityPreference || 'balanced'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Budget: ${preferences.budgetRange || 'moderate'}
- Pace: ${preferences.travelPace || 'moderate'}
- Time Rhythm: ${preferences.timeRhythm || 'daytime'}
- Comfort Zone: ${preferences.comfortZone || 5}/10
- Social Style: ${preferences.socialPreferences || 'couple'}

AVAILABLE OPTIONS:
- ${research.attractions.length} attractions
- ${research.restaurants.length} restaurants
- ${research.activities.length} activities

STRATEGIC QUESTIONS:
${userIntent ? `0. ⚠️ HOW will every day clearly serve "${userIntent}"? Each day's theme should reflect this.` : ''}
1. Pacing for their ${preferences.travelPace} pace and ${preferences.timeRhythm || 'daytime'} energy.
2. A theme per day that matches their motivations.
3. Activity-vs-rest balance for comfort zone ${preferences.comfortZone || 5}/10.
4. ${preferences.authenticityPreference || 'balanced'} (tourist vs local) emphasis.
5. ${preferences.socialPreferences || 'couple'} travel style fit.
6. ${preferences.planningStyle || 'balanced'} planning style — how much flexibility to leave?

Return exactly ${tripDays} day themes, one per trip day, in order.`;

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: PlanningStrategySchema,
    prompt: strategyPrompt,
    temperature: 0.8,
  });

  return object;
}

// ─── Step 2: per-day build ─────────────────────────────────────────────────

/**
 * Build one day given its theme, the destination, and the available pool.
 * Used in parallel — one of these per trip day. The orchestrator stamps the
 * correct calendar date afterward.
 *
 * `usedItems` is best-effort dedup hint; deterministic cross-day dedup
 * happens later in `runAgenticPlanner`.
 */
async function buildDayWithReasoning(
  dayNumber: number,
  theme: string,
  destination: string,
  availableOptions: {
    attractions: ResearchResult['attractions'];
    restaurants: ResearchResult['restaurants'];
    activities: ResearchResult['activities'];
  },
  preferences: UserPreferences,
  usedItems: Set<string>,
  userIntent?: string,
  rawPrompt?: string
): Promise<{
  day: DayPlan;
  reasoning: string[];
}> {
  const intentBlock = userIntent
    ? `\n🎯 PRIMARY OBJECTIVE FOR THE WHOLE TRIP — must show up TODAY:\nUser said: "${rawPrompt ?? userIntent}"\nFocus: "${userIntent}"\nThis day MUST include at least one item that obviously serves this focus.\n`
    : '';

  const dayPrompt = `You are planning Day ${dayNumber} of a trip to ${destination.toUpperCase()}.

🚨 CRITICAL: every activity MUST be in ${destination.toUpperCase()}. Verify each one.
${intentBlock}
THEME: ${theme}

USER PERSONALITY:
- Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Authenticity: ${preferences.authenticityPreference || 'balanced'}
- Time Rhythm: ${preferences.timeRhythm || 'steady_daytime'}
- Comfort Zone: ${preferences.comfortZone || 5}/10
- Social: ${preferences.socialPreferences || 'couple'}
- Interests: ${preferences.activityTypes.slice(0, 3).join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}

AVAILABLE OPTIONS (in ${destination}, not yet used):
${
  availableOptions.attractions.length > 0
    ? `Attractions: ${availableOptions.attractions
        .filter((a) => !usedItems.has(a.name))
        .slice(0, 10)
        .map((a) => `${a.name} (${a.category}, ${a.estimatedDuration}min, ${a.priceRange})`)
        .join(', ')}`
    : `(No pool — use your knowledge of ${preferences.activityTypes.slice(0, 3).join(', ')} in ${destination}.)`
}

${
  availableOptions.restaurants.length > 0
    ? `Restaurants: ${availableOptions.restaurants
        .filter((r) => !usedItems.has(r.name))
        .slice(0, 8)
        .map((r) => `${r.name} (${r.cuisine.join('/')}, ${r.priceRange})`)
        .join(', ')}`
    : `(No pool — use your knowledge of ${preferences.cuisinePreferences.slice(0, 2).join(', ')} restaurants in ${destination}.)`
}

${
  availableOptions.activities.length > 0
    ? `Activities: ${availableOptions.activities
        .filter((a) => !usedItems.has(a.name))
        .slice(0, 6)
        .map((a) => `${a.name} (${a.category}, ${a.duration}min)`)
        .join(', ')}`
    : `(No pool — use your knowledge of activities in ${destination}.)`
}

DAY SHAPE:
${
  dayNumber === 1
    ? '- First day: arrival, orientation, an iconic experience.'
    : dayNumber === 2
      ? '- Second day: explore different neighborhoods, new ground.'
      : dayNumber === 3
        ? '- Third day: deeper exploration, off-the-beaten-path.'
        : `- Day ${dayNumber}: keep finding new areas and experiences.`
}

${
  preferences.timeRhythm === 'early_bird'
    ? '- Early Morning (7-9am): 1 sunrise/early activity\n- Morning (9-12): 1-2 activities'
    : preferences.timeRhythm === 'night_owl'
      ? '- Late Morning (10-1): 1-2 activities (they sleep in)\n- Afternoon (1-6): lunch + 2 activities\n- Evening/Night (6-11): 2 activities + dinner (their peak)'
      : '- Morning (9-12): 1-2 activities\n- Afternoon (12-5): lunch + 1-2 activities\n- Evening (5-9): 1 activity + dinner'
}

GEOGRAPHIC RULES (CRITICAL):
1. Group all activities in ONE neighborhood/area.
2. Activities should be within 10-15 minutes of each other.
3. Lunch near morning activities; dinner near evening activities.
4. If you must move areas, do it once, cleanly.

PERSONALITY-DRIVEN CURATION:
- Authenticity: ${
    preferences.authenticityPreference === 'authentic_local'
      ? 'Local spots only, hidden gems, nothing touristy.'
      : preferences.authenticityPreference === 'popular_spots'
        ? 'Popular attractions are fine — they\'re famous for a reason.'
        : 'Mix of local and popular.'
  }
- Challenge: ${
    (preferences.comfortZone || 5) > 7
      ? 'Include adventurous/unusual activities.'
      : (preferences.comfortZone || 5) < 4
        ? 'Stick to well-known, comfortable options.'
        : 'Balanced mix.'
  }
- Social fit: ${
    preferences.socialPreferences === 'solo'
      ? 'Solo-friendly; opportunities to meet people if they\'re social.'
      : preferences.socialPreferences === 'couple'
        ? 'Romantic/intimate experiences.'
        : preferences.socialPreferences === 'small_group'
          ? 'Group-friendly for 3-5 people.'
          : 'Group-friendly for larger crowds.'
  }
- Motivations: prioritize ${preferences.travelMotivations?.join(', ') || 'general exploration'}.

CRITICAL RULES:
1. PROXIMITY FIRST: same neighborhood across the day.
2. NO DUPLICATES across the trip — avoid items already used.
3. Morning + afternoon + evening must all have items. No empty buckets.
4. No repeating the same place within the day.
5. Each item needs a UNIQUE, SPECIFIC name (e.g. "Ramen at Ichiran Shibuya" not "Ramen").
6. Include specific addresses or area names in descriptions for mapping.
${userIntent ? `7. **OBJECTIVE LOCK**: focus is "${userIntent}". This day MUST contain at least one item that obviously serves it.` : ''}`;

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: SingleDaySchema,
    prompt: dayPrompt,
    temperature: 0.8,
  });

  // Within-day dedupe (defensive — the schema doesn't enforce uniqueness).
  const dedupe = <T extends { name: string }>(items: T[], seen: Set<string>): T[] =>
    items.filter((item) => {
      if (!item.name) return false;
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const seenInDay = new Set<string>();
  const morning = dedupe(object.morning ?? [], seenInDay);
  const afternoon = dedupe(object.afternoon ?? [], seenInDay);
  const evening = dedupe(object.evening ?? [], seenInDay);

  // Track items used so the next day's prompt sees them filtered out.
  for (const item of [...morning, ...afternoon, ...evening]) {
    usedItems.add(item.name);
  }

  const day: DayPlan = {
    dayNumber,
    // Stamped properly by the orchestrator after Promise.all.
    date: new Date().toISOString().split('T')[0],
    morning,
    afternoon,
    evening,
    theme: object.theme || theme,
    notes: (object.reasoning ?? []).join(' '),
    estimatedCost: '$$$',
  };

  return { day, reasoning: object.reasoning ?? [] };
}

// ─── Public entry point ────────────────────────────────────────────────────

export async function runAgenticPlanner(request: PlanRequest): Promise<{
  plan: ItineraryPlan;
  thoughts: string[];
  reasoningSteps: ReasoningStep[];
}> {
  const { research, preferences, startDate, endDate, userIntent, rawPrompt } =
    request;
  const thoughts: string[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  const tripDays =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  thoughts.push(`🤖 AGENTIC PLANNER activated for ${tripDays}-day trip`);
  if (userIntent) {
    thoughts.push(`🎯 PRIMARY FOCUS: "${userIntent}"`);
  }

  // STEP 1: strategy
  thoughts.push('');
  thoughts.push('🧠 REASONING: Developing planning strategy...');

  const strategyStep: ReasoningStep = {
    thought:
      'Determine the best approach for this trip based on the user profile and the available pool',
    action: 'Creating strategic plan',
  };
  reasoningSteps.push(strategyStep);

  const strategy = await createPlanningStrategy(request);
  strategyStep.result = `Strategy: ${strategy.approach}`;

  thoughts.push(`💡 STRATEGY: ${strategy.approach}`);
  thoughts.push(`📋 REASONING: ${strategy.reasoning}`);
  thoughts.push(`🎯 PACING: ${strategy.pacingStrategy}`);
  thoughts.push(`🍽️ MEALS: ${strategy.mealStrategy}`);

  // STEP 2: per-day build, in parallel
  thoughts.push('');
  thoughts.push('🏗️ BUILDING: Creating day-by-day itinerary in parallel...');

  // Items used. Note: parallel calls share the *empty* set at start, so this
  // is a best-effort hint to the LLM. The deterministic cross-day dedup pass
  // below is the actual guarantee.
  const sharedUsed = new Set<string>();

  const dayPromises = Array.from({ length: tripDays }, (_, i) => {
    const dayNumber = i + 1;
    const theme = strategy.dayThemes[i] || `Day ${dayNumber}`;

    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dayDateIso = dayDate.toISOString().split('T')[0];

    thoughts.push(`  Day ${dayNumber}: ${theme}`);

    return buildDayWithReasoning(
      dayNumber,
      theme,
      research.destination,
      {
        attractions: research.attractions,
        restaurants: research.restaurants,
        activities: research.activities,
      },
      preferences,
      sharedUsed,
      userIntent,
      rawPrompt
    ).then(({ day, reasoning }) => {
      const step: ReasoningStep = {
        thought: `Planning Day ${dayNumber} with theme: ${theme}`,
        action: `Building activities for ${theme}`,
        result: `${day.morning.length + day.afternoon.length + day.evening.length} activities planned`,
      };
      reasoningSteps.push(step);
      reasoning.forEach((r) => thoughts.push(`    💭 ${r}`));
      // Stamp the correct calendar date for this day.
      return { ...day, date: dayDateIso };
    });
  });

  let days = await Promise.all(dayPromises);

  // STEP 2.5: deterministic cross-day dedup
  thoughts.push('');
  thoughts.push('🔍 DEDUPLICATING: Removing duplicate activities across days...');

  const globalUsed = new Set<string>();
  let removed = 0;

  const filterAcrossDays = (items: DayPlan['morning'], dayIdx: number) =>
    items.filter((item) => {
      const key = item.name.toLowerCase().trim();
      if (globalUsed.has(key)) {
        thoughts.push(`  ⚠️ Removed duplicate "${item.name}" from Day ${dayIdx + 1}`);
        removed++;
        return false;
      }
      globalUsed.add(key);
      return true;
    });

  days = days.map((day, idx) => ({
    ...day,
    morning: filterAcrossDays(day.morning, idx),
    afternoon: filterAcrossDays(day.afternoon, idx),
    evening: filterAcrossDays(day.evening, idx),
  }));

  if (removed === 0) {
    thoughts.push('  ✓ No duplicates found.');
  } else {
    thoughts.push(`  ✓ Removed ${removed} duplicate(s) across days.`);
  }

  // Sanity: warn if a day ended up empty.
  days.forEach((day, idx) => {
    const total = day.morning.length + day.afternoon.length + day.evening.length;
    if (total === 0) {
      thoughts.push(`  ⚠️ WARNING: Day ${idx + 1} has no activities after dedup.`);
    }
  });

  // STEP 3: validate
  thoughts.push('');
  thoughts.push('✅ VALIDATING: Checking itinerary flow...');

  reasoningSteps.push({
    thought: 'Validate overall structure',
    action: 'Validating',
    result: `${days.length} days planned with ${days.reduce(
      (s, d) => s + d.morning.length + d.afternoon.length + d.evening.length,
      0
    )} total activities`,
  });

  const plan: ItineraryPlan = {
    destination: research.destination,
    summary: `${tripDays}-day trip to ${research.destination}`,
    days,
    totalEstimatedCost: '$$$',
  };

  thoughts.push(
    `🎉 Plan complete: ${tripDays} days, ${plan.days.reduce(
      (s, d) => s + d.morning.length + d.afternoon.length + d.evening.length,
      0
    )} activities`
  );

  return { plan, thoughts, reasoningSteps };
}
