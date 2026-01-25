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
        timeout: 10000, // Reduced from 30s to 10s
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
 * Optimized to only scrape 2 most reliable sources for speed
 */
function buildSourceUrls(destination: string): Array<{ name: string; url: string; type: ScrapedSource['type'] }> {
  const encodedDest = encodeURIComponent(destination);
  const encodedDestThings = encodeURIComponent(`${destination} things to do`);
  
  return [
    // TripAdvisor - best for attractions
    {
      name: 'TripAdvisor',
      url: `https://www.tripadvisor.com/Search?q=${encodedDestThings}`,
      type: 'attractions' as const,
    },
    // Yelp - best for restaurants and local spots
    {
      name: 'Yelp',
      url: `https://www.yelp.com/search?find_desc=restaurants&find_loc=${encodedDest}`,
      type: 'restaurants' as const,
    },
  ];
}

/**
 * Research Agent - gathers and analyzes destination data from multiple sources
 * Set FAST_MODE=true to skip scraping and use AI knowledge only
 */
export async function runResearchAgent(request: ResearchRequest): Promise<{
  result: ResearchResult;
  thoughts: string[];
}> {
  const { destination, preferences } = request;
  let thoughts: string[] = [];
  
  // FAST MODE: Skip scraping entirely, use AI knowledge
  const FAST_MODE = true; // Hardcoded for speed - set to false to enable Firecrawl
  
  console.log(`[FAST_MODE] Enabled: ${FAST_MODE}`);
  
  if (FAST_MODE) {
    thoughts.push(`🚀 FAST MODE: Using AI knowledge for ${destination} (no scraping)`);
    thoughts.push(`User interests: ${preferences.activityTypes.join(', ')}`);
    
    const fastStartTime = Date.now();
    const fastResult = await generateResearchFromAI(destination, preferences);
    console.log(`[TIMING] Fast research AI completed in ${((Date.now() - fastStartTime) / 1000).toFixed(1)}s`);
    
    thoughts.push(`✅ Generated ${fastResult.attractions.length} attractions, ${fastResult.restaurants.length} restaurants`);
    
    return { result: fastResult, thoughts };
  }

  // NORMAL MODE: Scrape with Firecrawl
  thoughts.push(`🔍 Starting multi-source research for ${destination}...`);
  thoughts.push(`User interests: ${preferences.activityTypes.join(', ')}`);
  thoughts.push(`Budget: ${preferences.budgetRange}, Adventure: ${preferences.adventureTolerance}/10`);

  // Step 1: Scrape multiple sources in parallel
  thoughts.push('');
  thoughts.push('📡 Scraping data sources...');
  const scrapeStartTime = Date.now();
  
  const sourceConfigs = buildSourceUrls(destination);
  const scrapedSources: ScrapedSource[] = [];
  
  // Scrape ALL in parallel for maximum speed (only 2 sources now)
  const results = await Promise.all(
    sourceConfigs.map(async (config) => {
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

/**
 * Fast mode: Generate research using AI knowledge only (no scraping)
 */
async function generateResearchFromAI(destination: string, preferences: { activityTypes: string[]; cuisinePreferences: string[]; budgetRange: string; adventureTolerance: number }): Promise<ResearchResult> {
  const prompt = `Generate travel recommendations for ${destination}.

Preferences: ${preferences.activityTypes.slice(0, 3).join(', ')}, ${preferences.cuisinePreferences.slice(0, 3).join(', ')}, ${preferences.budgetRange} budget, adventure ${preferences.adventureTolerance}/10.

Return JSON with 10 attractions, 8 restaurants, 6 activities, 3 tips:
{"attractions":[{"name":"","description":"","category":"museums","estimatedDuration":90,"priceRange":"moderate","rating":4.5}],"restaurants":[{"name":"","cuisine":[""],"priceRange":"moderate","rating":4.5}],"activities":[{"name":"","description":"","category":"tours","duration":120,"adventureLevel":5,"priceRange":"moderate"}],"localInsights":[""]}`;

  try {
    const analysis = await generateText({
      model: openai('gpt-4o-mini'), // Use mini for speed
      prompt,
      temperature: 0.7,
    });

    const jsonMatch = analysis.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        destination,
        attractions: (parsed.attractions || []).map((a: Partial<AttractionData>) => ({
          name: a.name || 'Unknown',
          description: a.description || '',
          category: a.category || 'sightseeing',
          estimatedDuration: a.estimatedDuration || 90,
          priceRange: a.priceRange || 'moderate',
          rating: a.rating,
        })),
        restaurants: (parsed.restaurants || []).map((r: Partial<RestaurantData>) => ({
          name: r.name || 'Unknown',
          cuisine: Array.isArray(r.cuisine) ? r.cuisine : [r.cuisine || 'local'],
          priceRange: r.priceRange || 'moderate',
          rating: r.rating,
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
        localInsights: parsed.localInsights || [],
        bestTimeToVisit: parsed.bestTimeToVisit,
        sources: ['AI knowledge base'],
      };
    }
  } catch (error) {
    console.error('Fast mode AI error:', error);
  }

  return createFallbackResearch(destination, preferences);
}
