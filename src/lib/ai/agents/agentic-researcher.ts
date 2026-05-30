/**
 * Agentic Research Agent (Tavily-backed).
 *
 * Used to be a multi-step scraper that picked sources, scraped
 * Reddit/TripAdvisor/etc., and extracted entities from raw page markdown.
 *
 * Now it's a thin wrapper over `fetchDestinationDataWithPrefs`, which uses
 * Tavily search + LLM extraction. Tavily handles source selection internally,
 * so the "agentic strategy" layer here is much simpler.
 *
 * Same export signature — callers don't change.
 */

import { ResearchRequest, ResearchResult } from './types';
import { fetchDestinationDataWithPrefs } from '../tavily-service';

interface ReasoningStep {
  thought: string;
  action: string;
  result?: string;
}

export async function runAgenticResearcher(request: ResearchRequest): Promise<{
  result: ResearchResult;
  thoughts: string[];
  reasoningSteps: ReasoningStep[];
}> {
  const { destination, preferences, useAdvancedMode = false, userIntent } = request;
  const thoughts: string[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  thoughts.push(
    useAdvancedMode
      ? `🔬 Researching ${destination} (Tavily, advanced)`
      : `🤖 Researching ${destination} (Tavily)`
  );
  if (userIntent) {
    thoughts.push(`🎯 User focus injected into search: "${userIntent}"`);
  }

  reasoningSteps.push({
    thought: userIntent
      ? `Issue preference-shaped searches via Tavily, biased toward "${userIntent}"`
      : 'Issue preference-shaped searches via Tavily',
    action: `Querying for attractions, restaurants, and activities in ${destination}`,
  });

  const data = await fetchDestinationDataWithPrefs(destination, preferences, userIntent);

  reasoningSteps[0].result = `Found ${data.attractions.length} attractions, ${data.restaurants.length} restaurants, ${data.activities.length} activities`;

  thoughts.push(
    `✓ ${data.attractions.length} attractions, ${data.restaurants.length} restaurants, ${data.activities.length} activities curated from web search`
  );

  if (data.attractions.length === 0 && data.restaurants.length === 0) {
    thoughts.push('⚠️ No data returned — Tavily may be misconfigured or out of credits');
  }

  const result: ResearchResult = {
    destination,
    attractions: data.attractions,
    restaurants: data.restaurants,
    activities: data.activities,
    localTips: data.localTips,
    weatherInfo: data.weatherInfo,
  };

  return { result, thoughts, reasoningSteps };
}
