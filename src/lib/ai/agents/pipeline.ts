import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { MoveListSchema } from '../schemas/plan';
import { curateResearchByPreferences } from '@/lib/preferences/score-research';
import { buildProvenanceIndex, lookupSource, dedupeKey } from '../provenance';
import { normalizeItemType } from '../schemas/plan';
import { orderByStartTime, dropDuplicatePlans } from './order-plans';
import { checkPlan, type PlanCheck } from './plan-check';
import type {
  ActivityData,
  AttractionData,
  ItineraryPlan,
  PlanItem,
  ResearchResult,
  RestaurantData,
} from './types';
import type { UserPreferences } from '@/types/profile';

/**
 * The Spotz pipeline: prompt in, one flat ordered Move-list out.
 *
 * This replaces both orchestrators. They existed to iterate on a *schedule* —
 * re-planning until days clustered geographically, buckets filled, and clocks
 * ran forwards. None of that survives: Spotz selects real events and orders
 * them by the start time their source published.
 *
 * What is left is one pass:
 *
 *   curate by intent → select (1 LLM call) → stamp real times + provenance →
 *   dedupe → order by start time → check
 *
 * Fast and Deep are no longer different pipelines. They differ in how much
 * research feeds this one (`poolLimit`) and in delivery — Fast streams to the
 * screen, Deep runs in the background and emails.
 */

const SELECT_MODEL = process.env.PLANNER_MODEL || 'gpt-4o';

export interface PipelineInput {
  research: ResearchResult;
  preferences: UserPreferences;
  /** The user's free-text ask. The steering wheel. */
  userIntent?: string;
  rawPrompt?: string;
  /** How many candidates to put in front of the model. Deep mode sends more. */
  poolLimit?: number;
}

export interface PipelineOutput {
  success: boolean;
  plan?: ItineraryPlan;
  research: ResearchResult;
  check?: PlanCheck;
  error?: string;
}

type PoolCandidate = AttractionData | RestaurantData | ActivityData;

/** Everything the research pass produced, as one list. */
function allCandidates(research: ResearchResult): PoolCandidate[] {
  return [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ];
}

/** Real published start/end times, by normalized name. */
function buildTimeIndex(
  research: ResearchResult
): Map<string, { startsAt?: string; endsAt?: string }> {
  const index = new Map<string, { startsAt?: string; endsAt?: string }>();
  for (const item of research.activities ?? []) {
    const key = dedupeKey(item.name);
    if (!key || index.has(key)) continue;
    if (item.startsAt || item.endsAt) {
      index.set(key, { startsAt: item.startsAt, endsAt: item.endsAt });
    }
  }
  return index;
}

/** One line per candidate, with its real time when the source published one. */
function describeCandidate(item: PoolCandidate): string {
  const bits: string[] = [];
  if ('cuisine' in item && item.cuisine?.length) bits.push(item.cuisine.join('/'));
  if ('category' in item && item.category) bits.push(item.category);
  if (item.priceRange) bits.push(item.priceRange);
  if ('startsAt' in item && item.startsAt) {
    bits.push(
      `starts ${new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(item.startsAt))}`
    );
  }
  return `- ${item.name}${bits.length ? ` (${bits.join(', ')})` : ''}`;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { research, preferences, userIntent, rawPrompt, poolLimit = 24 } = input;

  // Rank the pool against the prompt before the model sees it, so the model is
  // choosing from an already-good set rather than doing the filtering itself.
  const curated = curateResearchByPreferences(
    research,
    preferences,
    { attractionLimit: poolLimit, restaurantLimit: poolLimit, activityLimit: poolLimit },
    userIntent
  );

  const candidates = allCandidates(curated);
  if (candidates.length === 0) {
    return { success: false, research: curated, error: 'No candidates to plan from' };
  }

  const prompt = `You are picking the moves for one night out in NYC.

${rawPrompt ? `What they asked for, verbatim: "${rawPrompt}"` : ''}
${userIntent ? `The vibe: ${userIntent}` : ''}

OPTIONS — pick ONLY from these. They are real, verified places and events:
${candidates.map(describeCandidate).join('\n')}

Pick 4-6 that make one good night together, best first.

RULES:
1. Use names EXACTLY as written above. Never invent a place.
2. No repeats.
3. Say why each fits what they asked for, in their language, not marketing copy.
4. Do NOT decide what time anything happens — the real times are already known.`;

  let object;
  try {
    ({ object } = await generateObject({
      model: openai(SELECT_MODEL),
      schema: MoveListSchema,
      prompt,
      temperature: 0.7,
      providerOptions: { openai: { strictJsonSchema: false } },
    }));
  } catch (error) {
    return {
      success: false,
      research: curated,
      error: error instanceof Error ? error.message : 'Selection failed',
    };
  }

  // Stamp the facts the model was never asked for: the real published time and
  // where each pick came from. Both are looked up from the pool by name, so a
  // pick the model invented gets no time and a source of 'ai'.
  const provenance = buildProvenanceIndex(candidates);
  const times = buildTimeIndex(curated);

  const stamped: PlanItem[] = object.plans.map((pick) => {
    const when = times.get(dedupeKey(pick.name));
    return {
      name: pick.name,
      type: normalizeItemType(pick.type),
      startsAt: when?.startsAt,
      endsAt: when?.endsAt,
      description: pick.description,
      matchReasons: pick.matchReasons,
      source: lookupSource(pick.name, provenance),
    };
  });

  const plans = orderByStartTime(dropDuplicatePlans(stamped));

  const plan: ItineraryPlan = {
    destination: curated.destination,
    summary: object.summary,
    plans,
    totalEstimatedCost: object.totalEstimatedCost ?? 'Varies',
    importantNotes: object.importantNotes ?? [],
  };

  return { success: true, plan, research: curated, check: checkPlan(plan, curated) };
}
