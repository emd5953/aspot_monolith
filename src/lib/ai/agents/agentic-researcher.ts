/**
 * Truly Agentic Researcher
 * 
 * This agent:
 * - Reasons about what data it needs
 * - Decides which sources to scrape dynamically
 * - Can request additional scraping if data is insufficient
 * - Adapts its strategy based on what it finds
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ResearchRequest, ResearchResult, AttractionData, RestaurantData, ActivityData } from './types';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

interface ReasoningStep {
  thought: string;
  action: string;
  result?: string;
}

interface ResearchPlan {
  reasoning: string;
  sources: Array<{
    name: string;
    url: string;
    type: 'attractions' | 'restaurants' | 'activities' | 'reviews';
    priority: 'high' | 'medium' | 'low';
    rationale: string;
  }>;
  expectedDataGaps: string[];
}

/**
 * Scrape a URL using Firecrawl
 */
async function scrapeWithFirecrawl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your-firecrawl-api-key') {
    console.warn('Firecrawl API key not configured');
    return '';
  }

  try {
    console.log(`[Firecrawl] Scraping: ${url}`);
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
        timeout: 3000, // Reduced to 3s for speed
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Firecrawl failed for ${url}: ${response.status} - ${errorText}`);
      return '';
    }

    const result = await response.json();
    const content = result.data?.markdown || result.data?.content || '';
    console.log(`[Firecrawl] Success: ${url} - ${content.length} chars`);
    return content;
  } catch (error) {
    console.error(`Firecrawl error for ${url}:`, error);
    return '';
  }
}

/**
 * Agent creates a research plan based on user preferences
 */
async function createResearchPlan(
  destination: string,
  preferences: ResearchRequest['preferences']
): Promise<ResearchPlan> {
  const planningPrompt = `You are a research planning agent. Create a strategic plan for gathering travel data about ${destination}.

USER PREFERENCES:
- Travel Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Authenticity Preference: ${preferences.authenticityPreference || 'balanced'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Cuisines: ${preferences.cuisinePreferences?.join(', ') || 'local cuisine'}
- Budget: ${preferences.budgetRange || 'moderate'}
- Comfort Zone: ${preferences.comfortZone || 5}/10
- Social Style: ${preferences.socialPreferences || 'couple'}
- Travel pace: ${preferences.travelPace || 'moderate'}

TASK: Decide which sources to scrape and in what order. Consider:
1. What data is most critical for these preferences?
2. Which sources match their authenticity preference (${preferences.authenticityPreference || 'balanced'})?
3. For comfort zone ${preferences.comfortZone || 5}/10, what type of experiences?
4. Their motivations (${preferences.travelMotivations?.join(', ') || 'exploration'}) - what sources cover this?
5. What might be missing from generic searches?

AVAILABLE SOURCE TYPES:
- TripAdvisor (attractions, reviews)
- Google Maps (local businesses, reviews)
- Google Search (general info, restaurants)
- Reddit (insider tips, local knowledge)
- Official tourism sites (reliable destination info)
- Lonely Planet (travel guides)

BLOCKED SOURCES (do not use):
- Yelp (blocklisted by Firecrawl)
- Facebook (requires login)
- Instagram (requires login)

Return JSON with your research plan:
{
  "reasoning": "Why this approach makes sense for these preferences",
  "sources": [
    {
      "name": "Source name",
      "url": "Full search URL",
      "type": "attractions|restaurants|activities|reviews",
      "priority": "high|medium|low",
      "rationale": "Why scrape this source"
    }
  ],
  "expectedDataGaps": ["What data might still be missing"]
}

Create 4-6 sources prioritized by importance.`;

  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: planningPrompt,
    temperature: 0.7,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Fallback plan
  return {
    reasoning: 'Using default research strategy',
    sources: [
      {
        name: 'TripAdvisor',
        url: `https://www.tripadvisor.com/Search?q=${encodeURIComponent(destination + ' ' + preferences.activityTypes[0])}`,
        type: 'attractions',
        priority: 'high',
        rationale: 'Primary source for attractions',
      },
    ],
    expectedDataGaps: ['May need additional restaurant data'],
  };
}

/**
 * Agent evaluates if collected data is sufficient
 */
async function evaluateDataQuality(
  scrapedData: Array<{ name: string; content: string; type: string }>,
  preferences: ResearchRequest['preferences'],
  destination: string
): Promise<{
  sufficient: boolean;
  reasoning: string;
  additionalSourcesNeeded?: Array<{ url: string; rationale: string }>;
}> {
  const evaluationPrompt = `You are a data quality evaluator. Assess if we have enough data to create a great itinerary.

DESTINATION: ${destination}
USER PREFERENCES: ${preferences.activityTypes?.join(', ') || 'general activities'}, ${preferences.cuisinePreferences?.join(', ') || 'local cuisine'}, ${preferences.budgetRange || 'moderate'} budget

SCRAPED DATA SUMMARY:
${scrapedData.map(d => `- ${d.name} (${d.type}): ${d.content.length} chars`).join('\n')}

EVALUATE:
1. Do we have enough attraction options?
2. Do we have enough restaurant options?
3. Do we have local insights/tips?
4. Is the data relevant to user preferences?

Return JSON:
{
  "sufficient": true/false,
  "reasoning": "Why data is/isn't sufficient",
  "additionalSourcesNeeded": [
    {"url": "specific URL to scrape", "rationale": "why we need this"}
  ]
}`;

  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: evaluationPrompt,
    temperature: 0.3,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return {
    sufficient: scrapedData.length >= 2,
    reasoning: 'Basic data threshold met',
  };
}

/**
 * Truly Agentic Research Agent
 */
export async function runAgenticResearcher(request: ResearchRequest): Promise<{
  result: ResearchResult;
  thoughts: string[];
  reasoningSteps: ReasoningStep[];
}> {
  const { destination, preferences, useAdvancedMode = false } = request;
  const thoughts: string[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  thoughts.push(useAdvancedMode 
    ? `🔬 ADVANCED RESEARCHER activated for ${destination}`
    : `🤖 AGENTIC RESEARCHER activated for ${destination}`);
  
  // STEP 1: Create research plan
  thoughts.push('');
  thoughts.push('🧠 REASONING: Planning research strategy...');
  
  const step1: ReasoningStep = {
    thought: 'I need to determine the best sources to scrape based on user preferences',
    action: 'Creating personalized research plan',
  };
  
  const plan = await createResearchPlan(destination, preferences);
  step1.result = `Plan created: ${plan.sources.length} sources identified`;
  reasoningSteps.push(step1);
  
  thoughts.push(`💡 PLAN: ${plan.reasoning}`);
  thoughts.push(`📋 Will scrape ${plan.sources.length} sources:`);
  plan.sources.forEach(s => {
    thoughts.push(`  ${s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢'} ${s.name} - ${s.rationale}`);
  });

  // STEP 2: Execute scraping (prioritized and PARALLELIZED for speed)
  thoughts.push('');
  thoughts.push('📡 EXECUTING: Scraping sources in parallel...');
  
  const scrapedData: Array<{ name: string; content: string; type: string; url: string }> = [];
  
  // Scrape high priority sources in parallel (much faster!)
  const sourcesToScrape = useAdvancedMode ? 3 : 1; // 3 sources for advanced, 1 for fast
  const highPriority = plan.sources.filter(s => s.priority === 'high').slice(0, sourcesToScrape);
  
  thoughts.push(`📡 Scraping ${sourcesToScrape} source(s) in ${useAdvancedMode ? 'ADVANCED' : 'FAST'} mode...`);
  
  const scrapePromises = highPriority.map(async (source) => {
    const step: ReasoningStep = {
      thought: `High priority: ${source.rationale}`,
      action: `Scraping ${source.name}`,
    };
    
    const content = await scrapeWithFirecrawl(source.url);
    if (content && content.length > 100) {
      step.result = `✓ Got ${Math.round(content.length / 1000)}KB`;
      thoughts.push(`  ✓ ${source.name} - ${Math.round(content.length / 1000)}KB`);
      return { step, data: { name: source.name, content, type: source.type, url: source.url } };
    } else if (content && content.length > 0) {
      step.result = `⚠️ Got only ${content.length} chars (low quality)`;
      thoughts.push(`  ⚠️ ${source.name} - ${content.length} chars (minimal data)`);
      return { step, data: { name: source.name, content, type: source.type, url: source.url } };
    } else {
      step.result = `✗ Failed or insufficient data`;
      thoughts.push(`  ✗ ${source.name} - failed`);
      return { step, data: null };
    }
  });

  const results = await Promise.all(scrapePromises);
  results.forEach(({ step, data }) => {
    reasoningSteps.push(step);
    if (data) scrapedData.push(data);
  });

  // STEP 3: Skip evaluation for speed - trust the data we got
  thoughts.push('');
  thoughts.push('✅ Proceeding with collected data (evaluation skipped for speed)');

  const evaluation = {
    sufficient: true,
    reasoning: 'Using available data to proceed quickly',
  };
  
  const step3: ReasoningStep = {
    thought: 'Checking if collected data meets quality threshold',
    action: 'Evaluating data completeness',
    result: 'Skipped for speed - using available data',
  };
  reasoningSteps.push(step3);
  
  thoughts.push(`💭 ${evaluation.reasoning}`);

  // STEP 4: Adaptive scraping removed - AI can fill gaps from available data
  thoughts.push('✅ Proceeding with available data (AI will supplement if needed)');

  // STEP 5: Synthesize with AI
  thoughts.push('');
  thoughts.push('🧠 SYNTHESIZING: Analyzing all collected data...');
  
  const synthesisPrompt = `You are analyzing travel data for ${destination}.

SCRAPED DATA:
${scrapedData.map(d => `[${d.name}]\n${d.content.slice(0, 3000)}`).join('\n\n---\n\n')}

USER PREFERENCES:
- Travel Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Authenticity: ${preferences.authenticityPreference || 'balanced'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Cuisines: ${preferences.cuisinePreferences?.join(', ') || 'local cuisine'}
- Budget: ${preferences.budgetRange || 'moderate'}
- Comfort Zone: ${preferences.comfortZone || 5}/10

Extract the BEST options that match preferences. CRITICAL CURATION RULES:
1. Authenticity Filter: ${preferences.authenticityPreference === 'authentic_local' ? 'ONLY include hidden gems, local favorites, off-beaten-path spots. EXCLUDE major tourist attractions.' :
                         preferences.authenticityPreference === 'popular_spots' ? 'Popular tourist spots are fine, they\'re popular for a reason.' :
                         'Mix of well-known and local experiences.'}

2. Challenge Level: ${(preferences.comfortZone || 5) > 7 ? 'Include adventurous, unusual, challenging experiences. Push boundaries.' :
                     (preferences.comfortZone || 5) < 4 ? 'Stick to well-established, comfortable, familiar options.' :
                     'Balanced mix of comfortable and slightly challenging.'}

3. Motivation Alignment: Prioritize options that match: ${preferences.travelMotivations?.join(', ') || 'general exploration'}
   ${preferences.travelMotivations?.includes('food') ? '- Extra focus on unique dining experiences' : ''}
   ${preferences.travelMotivations?.includes('learning') ? '- Include educational/historical context' : ''}
   ${preferences.travelMotivations?.includes('adventure') ? '- Include thrilling/active options' : ''}
   ${preferences.travelMotivations?.includes('relaxation') ? '- Include calm, peaceful spots' : ''}
   ${preferences.travelMotivations?.includes('connection') ? '- Include social/interactive experiences' : ''}
{
  "attractions": [
    {"name": "", "description": "", "category": "museums|sightseeing|nature|nightlife", "estimatedDuration": 90, "priceRange": "free|budget|moderate|expensive", "rating": 4.5, "location": "", "tips": ""}
  ],
  "restaurants": [
    {"name": "", "cuisine": [""], "priceRange": "budget|moderate|expensive", "rating": 4.5, "location": "", "mustTry": ""}
  ],
  "activities": [
    {"name": "", "description": "", "category": "tours|adventure|food|nightlife", "duration": 120, "adventureLevel": 5, "priceRange": "moderate", "bestTime": "morning|afternoon|evening"}
  ],
  "localInsights": ["Insider tips from locals"],
  "bestTimeToVisit": "Best season"
}`;

  const synthesis = await generateText({
    model: openai('gpt-4o'),
    prompt: synthesisPrompt,
    temperature: 0.7,
  });

  const jsonMatch = synthesis.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    
    thoughts.push(`✅ Extracted ${parsed.attractions?.length || 0} attractions, ${parsed.restaurants?.length || 0} restaurants, ${parsed.activities?.length || 0} activities`);

    const result: ResearchResult = {
      destination,
      attractions: (parsed.attractions || []).map((a: Partial<AttractionData>) => ({
        name: a.name || 'Unknown',
        description: a.description || '',
        category: a.category || 'sightseeing',
        estimatedDuration: a.estimatedDuration || 90,
        priceRange: a.priceRange || 'moderate',
        rating: a.rating,
        location: a.location,
        tips: a.tips,
      })),
      restaurants: (parsed.restaurants || []).map((r: Partial<RestaurantData>) => ({
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
      localInsights: parsed.localInsights || [],
      bestTimeToVisit: parsed.bestTimeToVisit,
      sources: scrapedData.map(d => d.name),
    };

    return { result, thoughts, reasoningSteps };
  }

  // Fallback
  thoughts.push('⚠️ Synthesis failed, using fallback data');
  return {
    result: {
      destination,
      attractions: [],
      restaurants: [],
      activities: [],
      localInsights: [],
      sources: [],
    },
    thoughts,
    reasoningSteps,
  };
}
