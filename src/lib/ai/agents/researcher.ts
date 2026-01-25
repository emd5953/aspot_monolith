/**
 * Research Agent
 * 
 * Specialized agent for gathering destination information.
 * Scrapes multiple sources: TripAdvisor, Yelp, Google, Reddit
 * Uses Firecrawl to scrape real data and AI to analyze/structure it.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ResearchRequest, ResearchResult, AttractionData, RestaurantData, ActivityData } from './types';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
  };
}

interface ScrapedSource {
  name: string;
  url: string;
  content: string;
  type: 'attractions' | 'restaurants' | 'activities' | 'reviews' | 'general';
}

/**
 * Scrape a URL using Firecrawl
 */
async function scrapeWithFirecrawl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your-firecrawl-api-key') {
    return '';
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      console.warn(`Firecrawl failed for ${url}: ${response.status}`);
      return '';
    }

    const result: FirecrawlResponse = await response.json();
    return result.data?.markdown || result.data?.content || '';
  } catch (error) {
    console.error('Firecrawl error:', error);
    return '';
  }
}

/**
 * Build search URLs for multiple sources
 * Optimized to only scrape the 3 most reliable sources
 */
function buildSourceUrls(destination: string): Array<{ name: string; url: string; type: ScrapedSource['type'] }> {
  const encodedDest = encodeURIComponent(destination);
  const encodedDestThings = encodeURIComponent(`${destination} things to do`);
  const encodedDestFood = encodeURIComponent(`${destination} best restaurants`);
  
  return [
    // TripAdvisor - attractions & activities
    {
      name: 'TripAdvisor Attractions',
      url: `https://www.tripadvisor.com/Search?q=${encodedDestThings}`,
      type: 'attractions' as const,
    },
    {
      name: 'TripAdvisor Restaurants',
      url: `https://www.tripadvisor.com/Search?q=${encodedDestFood}`,
      type: 'restaurants' as const,
    },
    // Yelp - restaurants & local businesses
    {
      name: 'Yelp Restaurants',
      url: `https://www.yelp.com/search?find_desc=restaurants&find_loc=${encodedDest}`,
      type: 'restaurants' as const,
    },
    {
      name: 'Yelp Things to Do',
      url: `https://www.yelp.com/search?find_desc=things+to+do&find_loc=${encodedDest}`,
      type: 'activities' as const,
    },
    // Google Travel (if accessible)
    {
      name: 'Google Travel',
      url: `https://www.google.com/travel/things-to-do/see-all?dest_mid=&dest_state_type=sattd&dest_src=ts&q=${encodedDest}`,
      type: 'attractions' as const,
    },
  ];
}

/**
 * Research Agent - gathers and analyzes destination data from multiple sources
 */
export async function runResearchAgent(request: ResearchRequest): Promise<{
  result: ResearchResult;
  thoughts: string[];
}> {
  const { destination, preferences } = request;
  const thoughts: string[] = [];

  thoughts.push(`🔍 Starting multi-source research for ${destination}...`);
  thoughts.push(`User interests: ${preferences.activityTypes.join(', ')}`);
  thoughts.push(`Budget: ${preferences.budgetRange}, Adventure: ${preferences.adventureTolerance}/10`);

  // Step 1: Scrape multiple sources in parallel
  thoughts.push('');
  thoughts.push('📡 Scraping data sources...');
  const scrapeStartTime = Date.now();
  
  const sourceConfigs = buildSourceUrls(destination);
  const scrapedSources: ScrapedSource[] = [];
  
  // Scrape in parallel batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < sourceConfigs.length; i += batchSize) {
    const batch = sourceConfigs.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (config) => {
        const content = await scrapeWithFirecrawl(config.url);
        return { ...config, content };
      })
    );
    
    for (const result of results) {
      if (result.content && result.content.length > 100) {
        scrapedSources.push(result);
        thoughts.push(`  ✓ ${result.name} - ${Math.round(result.content.length / 1000)}KB`);
      } else {
        thoughts.push(`  ✗ ${result.name} - no data`);
      }
    }
  }

  console.log(`[TIMING] Scraping completed in ${((Date.now() - scrapeStartTime) / 1000).toFixed(1)}s`);
  thoughts.push('');
  thoughts.push(`📊 Collected data from ${scrapedSources.length}/${sourceConfigs.length} sources`);

  // Step 2: Use AI to analyze and synthesize all scraped data
  thoughts.push('');
  thoughts.push('🧠 Analyzing data with AI...');

  // Organize content by type
  const attractionContent = scrapedSources
    .filter(s => s.type === 'attractions' || s.type === 'general')
    .map(s => `[${s.name}]\n${s.content}`)
    .join('\n\n---\n\n')
    .slice(0, 6000);

  const restaurantContent = scrapedSources
    .filter(s => s.type === 'restaurants')
    .map(s => `[${s.name}]\n${s.content}`)
    .join('\n\n---\n\n')
    .slice(0, 4000);

  const reviewContent = scrapedSources
    .filter(s => s.type === 'reviews')
    .map(s => `[${s.name}]\n${s.content}`)
    .join('\n\n---\n\n')
    .slice(0, 4000);

  const activityContent = scrapedSources
    .filter(s => s.type === 'activities')
    .map(s => `[${s.name}]\n${s.content}`)
    .join('\n\n---\n\n')
    .slice(0, 3000);

  const analysisPrompt = `You are a travel research expert analyzing data from multiple sources about ${destination}.

SCRAPED DATA FROM TRIPADVISOR, YELP, GOOGLE, LONELY PLANET:
${attractionContent || 'No attraction data scraped.'}

RESTAURANT DATA FROM YELP & TRIPADVISOR:
${restaurantContent || 'No restaurant data scraped.'}

ACTIVITY DATA:
${activityContent || 'No activity data scraped.'}

REDDIT DISCUSSIONS & LOCAL INSIGHTS:
${reviewContent || 'No Reddit data scraped.'}

USER PREFERENCES:
- Activities they enjoy: ${preferences.activityTypes.join(', ')}
- Budget: ${preferences.budgetRange}
- Cuisine preferences: ${preferences.cuisinePreferences.join(', ')}
- Adventure tolerance: ${preferences.adventureTolerance}/10
- Travel pace: ${preferences.travelPace}

INSTRUCTIONS:
1. Extract the TOP 12 attractions that match user interests
2. Extract the TOP 10 restaurants matching cuisine/budget preferences
3. Extract the TOP 8 activities matching adventure level
4. Synthesize LOCAL INSIDER TIPS from Reddit discussions
5. Note any warnings or things to avoid mentioned in reviews

${scrapedSources.length === 0 ? 'NOTE: No data was scraped. Use your knowledge about ' + destination + ' instead.' : ''}

RESPOND ONLY WITH VALID JSON:
{
  "attractions": [
    {"name": "Actual Place Name", "description": "What makes it special", "category": "museums/sightseeing/nature/nightlife/shopping", "estimatedDuration": 90, "priceRange": "free/budget/moderate/expensive/luxury", "rating": 4.5, "location": "neighborhood", "tips": "insider tip from reviews"}
  ],
  "restaurants": [
    {"name": "Actual Restaurant Name", "cuisine": ["italian", "local"], "priceRange": "budget/moderate/expensive/luxury", "rating": 4.5, "location": "area", "mustTry": "signature dish"}
  ],
  "activities": [
    {"name": "Activity Name", "description": "What you do", "category": "tours/adventure/food/nightlife/relaxation", "duration": 120, "adventureLevel": 5, "priceRange": "moderate", "bestTime": "morning/afternoon/evening"}
  ],
  "localInsights": ["Real tips from Reddit and reviews - things only locals know"],
  "warnings": ["Things to avoid or be careful about"],
  "bestTimeToVisit": "Best season/time",
  "neighborhoods": ["Cool areas to explore"]
}`;

  try {
    const analysis = await generateText({
      model: openai('gpt-4o'),
      prompt: analysisPrompt,
      temperature: 0.7,
    });

    // Parse the JSON response
    const jsonMatch = analysis.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      thoughts.push(`  Found ${parsed.attractions?.length || 0} attractions`);
      thoughts.push(`  Found ${parsed.restaurants?.length || 0} restaurants`);
      thoughts.push(`  Found ${parsed.activities?.length || 0} activities`);
      thoughts.push(`  Extracted ${parsed.localInsights?.length || 0} local tips`);

      const result: ResearchResult = {
        destination,
        attractions: (parsed.attractions || []).map((a: Partial<AttractionData> & { location?: string }) => ({
          name: a.name || 'Unknown',
          description: a.description || '',
          category: a.category || 'sightseeing',
          estimatedDuration: a.estimatedDuration || 90,
          priceRange: a.priceRange || 'moderate',
          rating: a.rating,
          location: a.location,
          tips: a.tips,
        })),
        restaurants: (parsed.restaurants || []).map((r: Partial<RestaurantData> & { location?: string }) => ({
          name: r.name || 'Unknown',
          cuisine: Array.isArray(r.cuisine) ? r.cuisine : [r.cuisine || 'local'],
          priceRange: r.priceRange || 'moderate',
          rating: r.rating,
          location: r.location,
          mustTry: r.mustTry,
        })),
        activities: (parsed.activities || []).map((a: Partial<ActivityData>) => ({
          name: a.name || 'Unknown',
          description: a.description || '',
          category: a.category || 'activity',
          duration: a.duration || 120,
          adventureLevel: a.adventureLevel || 5,
          priceRange: a.priceRange || 'moderate',
          bestTime: a.bestTime,
        })),
        localInsights: [
          ...(parsed.localInsights || []),
          ...(parsed.warnings || []).map((w: string) => `⚠️ ${w}`),
        ],
        bestTimeToVisit: parsed.bestTimeToVisit,
        sources: scrapedSources.map(s => s.name),
      };

      thoughts.push('');
      thoughts.push('✅ Research complete!');
      thoughts.push(`Sources used: ${result.sources.join(', ')}`);
      
      return { result, thoughts };
    }
  } catch (error) {
    thoughts.push(`❌ Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fallback result
  thoughts.push('');
  thoughts.push('⚠️ Using fallback research data...');
  return {
    result: createFallbackResearch(destination, preferences),
    thoughts,
  };
}

function createFallbackResearch(destination: string, preferences: { activityTypes: string[]; budgetRange: string }): ResearchResult {
  return {
    destination,
    attractions: [
      { name: `${destination} Historic Center`, description: 'Explore the heart of the city', category: 'sightseeing', estimatedDuration: 120, priceRange: 'free', rating: 4.7 },
      { name: `${destination} National Museum`, description: 'Rich cultural heritage', category: 'museums', estimatedDuration: 90, priceRange: 'moderate', rating: 4.5 },
      { name: `${destination} Main Square`, description: 'Vibrant central plaza', category: 'sightseeing', estimatedDuration: 60, priceRange: 'free', rating: 4.6 },
    ],
    restaurants: [
      { name: `Local Flavors ${destination}`, cuisine: ['local', 'traditional'], priceRange: 'moderate', rating: 4.6 },
      { name: 'Street Food Market', cuisine: ['streetfood'], priceRange: 'budget', rating: 4.7 },
    ],
    activities: [
      { name: `Walking Tour of ${destination}`, description: 'Guided city exploration', category: 'tours', duration: 180, adventureLevel: 2, priceRange: 'moderate', bestTime: 'morning' },
      { name: 'Food Tasting Tour', description: 'Sample local cuisine', category: 'food', duration: 240, adventureLevel: 2, priceRange: 'moderate', bestTime: 'afternoon' },
    ],
    localInsights: [
      'Learn a few local phrases - locals appreciate the effort',
      'Visit popular spots early morning to avoid crowds',
      'Try the local street food for authentic flavors',
    ],
    sources: ['AI knowledge base'],
  };
}
