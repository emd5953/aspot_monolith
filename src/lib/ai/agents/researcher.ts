/**
 * Research Agent (Tavily-backed).
 *
 * Used to coordinate multi-source web scraping. Now collapses to a
 * single Tavily-search-with-prefs call. Same export signature.
 */

import { ResearchRequest, ResearchResult } from './types';
import { fetchDestinationDataWithPrefs } from '../tavily-service';

export async function runResearchAgent(request: ResearchRequest): Promise<{
  result: ResearchResult;
  thoughts: string[];
}> {
  const { destination, preferences } = request;
  const thoughts: string[] = [];

  thoughts.push(`🔍 Researching ${destination} via Tavily…`);
  thoughts.push(
    `User interests: ${preferences.activityTypes?.join(', ') || 'general activities'}`
  );
  thoughts.push(
    `Budget: ${preferences.budgetRange}, Comfort: ${preferences.comfortZone}/10`
  );

  const data = await fetchDestinationDataWithPrefs(destination, preferences);

  thoughts.push(
    `✓ ${data.attractions.length} attractions, ${data.restaurants.length} restaurants, ${data.activities.length} activities`
  );

  if (data.attractions.length === 0 && data.restaurants.length === 0) {
    thoughts.push('⚠️ No data — check TAVILY_API_KEY or quota');
  }

  return {
    result: {
      destination,
      attractions: data.attractions,
      restaurants: data.restaurants,
      activities: data.activities,
      localTips: data.localTips,
      weatherInfo: data.weatherInfo,
    },
    thoughts,
  };
}
