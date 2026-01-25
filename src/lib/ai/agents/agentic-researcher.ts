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
        timeout: 10000,
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
- Interests: ${preferences.activityTypes.join(', ')}
- Cuisines: ${preferences.cuisinePreferences.join(', ')}
- Budget: ${preferences.budgetRange}
- Comfort Zone: ${preferences.comfortZone || 5}/10
- Social Style: ${preferences.socialPreferences || 'couple'}
- Travel pace: ${preferences.travelPace}

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
USER PREFERENCES: ${preferences.activityTypes.join(', ')}, ${preferences.cuisinePreferences.join(', ')}, ${preferences.budgetRange} budget

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
  const { destination, preferences } = request;
  const thoughts: string[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  thoughts.push(`🤖 AGENTIC RESEARCHER activated for ${destination}`);
  
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

  // STEP 2: Execute scraping (prioritized)
  thoughts.push('');
  thoughts.push('📡 EXECUTING: Scraping sources...');
  
  const scrapedData: Array<{ name: string; content: string; type: string; url: string }> = [];
  
  // Scrape high priority first
  const highPriority = plan.sources.filter(s => s.priority === 'high');
  for (const source of highPriority) {
    const step: ReasoningStep = {
      thought: `High priority: ${source.rationale}`,
      action: `Scraping ${source.name}`,
    };
    
    const content = await scrapeWithFirecrawl(source.url);
    if (content && content.length > 100) {
      scrapedData.push({ name: source.name, content, type: source.type, url: source.url });
      step.result = `✓ Got ${Math.round(content.length / 1000)}KB`;
      thoughts.push(`  ✓ ${source.name} - ${Math.round(content.length / 1000)}KB`);
    } else if (content && content.length > 0) {
      // Got some data but very little
      scrapedData.push({ name: source.name, content, type: source.type, url: source.url });
      step.result = `⚠️ Got only ${content.length} chars (low quality)`;
      thoughts.push(`  ⚠️ ${source.name} - ${content.length} chars (minimal data)`);
    } else {
      step.result = `✗ Failed or insufficient data`;
      thoughts.push(`  ✗ ${source.name} - failed`);
    }
    reasoningSteps.push(step);
  }

  // STEP 3: Evaluate if we need more data
  thoughts.push('');
  thoughts.push('🔍 EVALUATING: Is data sufficient?');
  
  const evaluation = await evaluateDataQuality(scrapedData, preferences, destination);
  
  const step3: ReasoningStep = {
    thought: 'Checking if collected data meets quality threshold',
    action: 'Evaluating data completeness',
    result: evaluation.reasoning,
  };
  reasoningSteps.push(step3);
  
  thoughts.push(`💭 ${evaluation.reasoning}`);

  // STEP 4: Adaptive scraping if needed
  if (!evaluation.sufficient && evaluation.additionalSourcesNeeded) {
    thoughts.push('');
    thoughts.push('🔄 ADAPTING: Need more data, scraping additional sources...');
    
    for (const additional of evaluation.additionalSourcesNeeded.slice(0, 2)) {
      const step: ReasoningStep = {
        thought: additional.rationale,
        action: `Additional scraping: ${additional.url}`,
      };
      
      const content = await scrapeWithFirecrawl(additional.url);
      if (content && content.length > 100) {
        scrapedData.push({ 
          name: 'Additional source', 
          content, 
          type: 'general',
          url: additional.url 
        });
        step.result = `✓ Got ${Math.round(content.length / 1000)}KB`;
        thoughts.push(`  ✓ Additional data - ${Math.round(content.length / 1000)}KB`);
      } else {
        step.result = `✗ Failed`;
        thoughts.push(`  ✗ Additional scraping failed`);
      }
      reasoningSteps.push(step);
    }
  } else {
    thoughts.push('✅ Data quality sufficient, proceeding to analysis');
  }

  // STEP 5: Synthesize with AI
  thoughts.push('');
  thoughts.push('🧠 SYNTHESIZING: Analyzing all collected data...');
  
  const synthesisPrompt = `You are analyzing travel data for ${destination}.

SCRAPED DATA:
${scrapedData.map(d => `[${d.name}]\n${d.content.slice(0, 3000)}`).join('\n\n---\n\n')}

USER PREFERENCES:
- Travel Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Authenticity: ${preferences.authenticityPreference || 'balanced'}
- Interests: ${preferences.activityTypes.join(', ')}
- Cuisines: ${preferences.cuisinePreferences.join(', ')}
- Budget: ${preferences.budgetRange}
- Comfort Zone: ${preferences.comfortZone || 5}/10

Extract the BEST options that match preferences. CRITICAL CURATION RULES:
1. Authenticity Filter: ${preferences.authenticityPreference === 'pure_authentic' ? 'ONLY include hidden gems, local favorites, off-beaten-path spots. EXCLUDE major tourist attractions.' :
                         preferences.authenticityPreference === 'mostly_authentic' ? 'Prioritize local spots but 1-2 popular attractions OK.' :
                         preferences.authenticityPreference === 'tourist_friendly' ? 'Popular tourist spots are fine, they\'re popular for a reason.' :
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
