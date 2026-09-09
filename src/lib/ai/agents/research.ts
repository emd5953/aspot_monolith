import { runAgenticResearcher } from './agentic-researcher';
import { getCachedResearch, setCachedResearch } from '../research-cache';
import type { ActivityData, ResearchResult } from './types';
import type { UserPreferences } from '@/types/profile';

/**
 * Discover: get a pool of real candidates to choose from.
 *
 * Lifted out of the orchestrators so the pipeline can reuse the two rules that
 * were buried in them and are easy to get wrong:
 *
 *  1. **Cache, then merge.** Pool events are merged AFTER the research cache is
 *     read, never before. Caching a merged result would let a cache hit serve
 *     last week's events as tonight's.
 *  2. **Never cache an empty result.** A transient Tavily failure returning
 *     nothing must not poison the next hour of requests for that destination.
 */

export interface DiscoverInput {
  destination: string;
  preferences: UserPreferences;
  userIntent?: string;
  rawPrompt?: string;
  startDate?: Date;
  endDate?: Date;
  /** Live Moves from the candidate pool, already converted. */
  poolEvents?: ActivityData[];
  /** Deep mode: wider scrape. */
  useAdvancedMode?: boolean;
}

export async function discoverCandidates(
  input: DiscoverInput
): Promise<{ research: ResearchResult; fromCache: boolean }> {
  const {
    destination,
    preferences,
    userIntent,
    rawPrompt,
    startDate,
    endDate,
    poolEvents,
    useAdvancedMode = false,
  } = input;

  // Keyed by destination + intent, so an "R&B bars" pool is not served to a
  // generic request and vice versa.
  const cached = getCachedResearch(destination, userIntent);
  let research: ResearchResult;
  let fromCache = false;

  if (cached) {
    research = cached.result;
    fromCache = true;
  } else {
    const result = await runAgenticResearcher({
      destination,
      preferences,
      useAdvancedMode,
      userIntent,
      rawPrompt,
      startDate,
      endDate,
    });
    research = result.result;
    const hasData =
      (research.attractions?.length ?? 0) > 0 || (research.restaurants?.length ?? 0) > 0;
    if (hasData) setCachedResearch(destination, research, result.thoughts, userIntent);
  }

  // Merge live events AFTER the cache read. Pool events lead: they are the
  // time-anchored Moves, and everything else is the fallback around them.
  if (poolEvents?.length) {
    research = {
      ...research,
      activities: [...poolEvents, ...(research.activities ?? [])],
    };
  }

  return { research, fromCache };
}
