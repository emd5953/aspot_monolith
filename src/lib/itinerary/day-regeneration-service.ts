import { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { UserPreferences } from '@/types/quiz';

interface RegenerateDayInput {
  itineraryId: string;
  dayId: string;
  dayNumber: number;
  date: Date;
  destination: string;
  userPrompt: string;
  preferences: UserPreferences;
  mode?: 'fast' | 'credible';
}

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  category: string;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
}

interface UserIntent {
  keywords: string[];
  categories: string[];
  searchQueries: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  specificRequests: string[];
}

interface ScrapedPlace {
  name: string;
  description: string;
  type: string;
  details?: string;
  url?: string;
}

/**
 * Analyze user's natural language prompt to understand intent
 */
async function analyzeUserIntent(
  userPrompt: string,
  preferences: UserPreferences
): Promise<UserIntent> {
  const analysisPrompt = `Analyze this travel request and extract structured intent:

User Request: "${userPrompt}"
User Preferences: ${preferences.activityTypes.join(', ')}

Extract:
1. Keywords (important words like "clubbing", "sports", "thrift store")
2. Categories (nightlife, sports, shopping, food, etc.)
3. Search queries (what to search on Google/TripAdvisor)
4. Time of day (morning/afternoon/evening/night)
5. Specific requests (list each distinct thing they want)

Return JSON:
{
  "keywords": ["clubbing", "sports"],
  "categories": ["nightlife", "sports"],
  "searchQueries": ["best nightclubs in [destination]", "sports events [destination]"],
  "timeOfDay": "night",
  "specificRequests": ["watch a sports game", "go clubbing"]
}`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: analysisPrompt,
    temperature: 0.3,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Fallback: basic keyword extraction
  return {
    keywords: userPrompt.toLowerCase().split(' ').filter(w => w.length > 3),
    categories: ['general'],
    searchQueries: [userPrompt],
    specificRequests: [userPrompt],
  };
}

/**
 * Scrape targeted data based on user intent
 */
async function scrapeTargetedData(
  destination: string,
  intent: UserIntent,
  date: Date
): Promise<ScrapedPlace[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your-firecrawl-api-key') {
    console.warn('[Scraping] Firecrawl not configured, using fallback');
    return [];
  }

  const scrapedPlaces: ScrapedPlace[] = [];

  // Format date for search queries
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

  // Build targeted search queries WITHOUT specific dates (too narrow)
  const queries = intent.searchQueries.map(q => {
    let query = q.replace('[destination]', destination);
    
    // For events/sports, use general queries (not date-specific)
    // Date-specific queries for future dates return 0 results
    if (intent.categories.includes('sports') || 
        intent.categories.includes('events') ||
        q.toLowerCase().includes('event') ||
        q.toLowerCase().includes('game')) {
      // Use day of week instead of specific date
      query += ` ${dayOfWeek}`;
    }
    
    return query;
  });

  console.log('[Scraping] Targeted queries:', queries);

  // Scrape each query
  for (const query of queries.slice(0, 3)) { // Limit to 3 queries for speed
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url: searchUrl,
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 8000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.data?.markdown || '';
        
        // Extract place names and info from scraped content
        const places = extractPlacesFromContent(content, intent.categories, date);
        scrapedPlaces.push(...places);
        
        console.log(`[Scraping] Found ${places.length} places for query: ${query}`);
      }
    } catch (error) {
      console.error(`[Scraping] Failed for query: ${query}`, error);
    }
  }

  // For sports/events, also try event-specific sites
  if (intent.categories.includes('sports') || intent.categories.includes('events')) {
    console.log('[Scraping] Checking event-specific sources...');
    const eventPlaces = await scrapeEventSources(destination, date, intent.keywords);
    scrapedPlaces.push(...eventPlaces);
  }

  // Always scrape Reddit for local insider tips (gold mine!)
  console.log('[Scraping] Checking Reddit for local insights...');
  const redditPlaces = await scrapeRedditInsights(destination, intent.keywords, dayOfWeek);
  scrapedPlaces.push(...redditPlaces);

  // If we got very few results, try TripAdvisor as fallback
  if (scrapedPlaces.length < 3) {
    console.log('[Scraping] Low results, trying TripAdvisor fallback...');
    const tripAdvisorPlaces = await scrapeTripAdvisor(destination, intent.keywords);
    scrapedPlaces.push(...tripAdvisorPlaces);
  }

  return scrapedPlaces;
}

/**
 * Extract place information from scraped content
 */
function extractPlacesFromContent(
  content: string,
  categories: string[],
  date?: Date
): ScrapedPlace[] {
  const places: ScrapedPlace[] = [];
  
  // Simple extraction: look for patterns like "Name - Description" or "Name: Description"
  const lines = content.split('\n');
  
  // For events, look for date mentions to validate
  const dateStr = date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const dayOfWeek = date?.toLocaleDateString('en-US', { weekday: 'long' });
  
  for (const line of lines) {
    // Skip very short lines
    if (line.length < 20) continue;
    
    // Look for place-like patterns
    const patterns = [
      /^[\d.]+\.\s*\*\*(.+?)\*\*[:\-](.+)$/,  // "1. **Name**: Description"
      /^[\*\-]\s*\*\*(.+?)\*\*[:\-](.+)$/,     // "* **Name**: Description"
      /^(.+?)\s*[\-–]\s*(.+)$/,                 // "Name - Description"
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1].trim();
        const description = match[2].trim();
        
        // Filter out non-place content
        if (name.length > 3 && name.length < 100 && !name.includes('http')) {
          // Accept all places - don't filter by date (too restrictive for future dates)
          places.push({
            name,
            description: description.substring(0, 200),
            type: categories[0] || 'general',
            details: date ? `Suggested for ${dateStr}` : undefined,
          });
        }
        break;
      }
    }
    
    // Limit results
    if (places.length >= 10) break;
  }
  
  return places;
}

/**
 * Scrape Reddit for local insider tips and recommendations
 */
async function scrapeRedditInsights(
  destination: string,
  keywords: string[],
  dayOfWeek?: string
): Promise<ScrapedPlace[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your-firecrawl-api-key') {
    return [];
  }

  const places: ScrapedPlace[] = [];

  // Build Reddit-specific queries
  const redditQueries = [
    `site:reddit.com ${destination} ${keywords[0] || 'things to do'}`,
    `site:reddit.com ${destination} hidden gems`,
    `site:reddit.com ${destination} locals recommend`,
  ];

  if (dayOfWeek) {
    redditQueries.push(`site:reddit.com ${destination} ${dayOfWeek} night`);
  }

  console.log('[Reddit] Scraping for local insights...');

  for (const query of redditQueries.slice(0, 2)) { // Limit to 2 Reddit queries
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url: searchUrl,
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 8000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.data?.markdown || '';
        
        // Extract recommendations from Reddit discussions
        const lines = content.split('\n');
        for (const line of lines) {
          // Look for place mentions in Reddit format
          // Common patterns: "I recommend X", "Check out X", "X is amazing"
          const patterns = [
            /(?:recommend|check out|try|visit|go to)\s+([A-Z][A-Za-z\s&'-]{3,50})/gi,
            /([A-Z][A-Za-z\s&'-]{3,50})\s+is\s+(?:amazing|great|awesome|fantastic|the best)/gi,
          ];
          
          for (const pattern of patterns) {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
              const name = match[1]?.trim();
              if (name && name.length > 3 && name.length < 50 && !name.includes('http')) {
                // Extract context around the mention
                const context = line.substring(Math.max(0, match.index! - 50), match.index! + 100);
                
                places.push({
                  name,
                  description: `Local recommendation from Reddit: ${context.substring(0, 150)}`,
                  type: keywords[0] || 'general',
                  details: 'Reddit insider tip',
                });
                
                if (places.length >= 10) break;
              }
            }
            if (places.length >= 10) break;
          }
          if (places.length >= 10) break;
        }
        
        console.log(`[Reddit] Found ${places.length} recommendations from: ${query}`);
      }
    } catch (error) {
      console.error(`[Reddit] Failed for query: ${query}`, error);
    }
  }

  // Deduplicate by name
  const uniquePlaces = Array.from(
    new Map(places.map(p => [p.name.toLowerCase(), p])).values()
  );

  return uniquePlaces.slice(0, 5); // Limit Reddit results to 5
}

/**
 * Fallback: Scrape TripAdvisor for general recommendations
 */
async function scrapeTripAdvisor(
  destination: string,
  keywords: string[]
): Promise<ScrapedPlace[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) return [];

  try {
    const searchTerm = keywords.length > 0 
      ? `${destination} ${keywords[0]}` 
      : destination;
    
    const url = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(searchTerm)}`;
    
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
        timeout: 8000,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.data?.markdown || '';
      return extractPlacesFromContent(content, ['attraction']);
    }
  } catch (error) {
    console.error('[Scraping] TripAdvisor fallback failed:', error);
  }

  return [];
}

/**
 * Scrape ANY events happening on a specific date (fallback when specific event type not found)
 */
async function scrapeAnyEventsOnDate(
  destination: string,
  date: Date
): Promise<ScrapedPlace[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY === 'your-firecrawl-api-key') {
    return [];
  }

  const places: ScrapedPlace[] = [];
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

  // Try multiple general event search strategies
  const searchQueries = [
    `events in ${destination} ${dayOfWeek}`, // Day of week (more results)
    `things to do ${destination} ${dayOfWeek}`, // General activities
    `${destination} events this weekend`, // If it's a weekend
    `concerts shows ${destination}`, // Entertainment
    `site:reddit.com ${destination} events ${dayOfWeek}`, // Reddit local insights
    `${destination} nightlife ${dayOfWeek} reviews`, // Google reviews for nightlife
  ];

  console.log(`[Scraping] Searching for any events on ${dayOfWeek}, ${dateStr}...`);

  for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries (includes Reddit/reviews)
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url: searchUrl,
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 8000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.data?.markdown || '';
        
        // Extract any events/activities
        const extractedPlaces = extractPlacesFromContent(content, ['events', 'entertainment'], date);
        places.push(...extractedPlaces);
        
        console.log(`[Scraping] Found ${extractedPlaces.length} general events for: ${query}`);
      }
    } catch (error) {
      console.error(`[Scraping] Failed for query: ${query}`, error);
    }
  }

  // Also try event aggregator sites
  const eventSites = [
    `https://www.eventbrite.com/d/${destination.toLowerCase().replace(/\s+/g, '-')}/events`,
    `https://www.timeout.com/${destination.toLowerCase().replace(/\s+/g, '-')}/things-to-do`,
  ];

  for (const url of eventSites.slice(0, 1)) { // Just try one
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
          timeout: 8000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.data?.markdown || '';
        
        // Look for any events
        const lines = content.split('\n');
        for (const line of lines) {
          // Look for event-like patterns
          if (line.length > 20 && line.length < 200) {
            // Common event patterns
            const eventPatterns = [
              /^[\*\-]\s*(.+?)\s*[-–]\s*(.+)$/,
              /^(.+?)\s*\|\s*(.+)$/,
              /^[\d.]+\.\s*(.+)$/,
            ];
            
            for (const pattern of eventPatterns) {
              const match = line.match(pattern);
              if (match) {
                const name = match[1]?.trim();
                const description = match[2]?.trim() || 'Event';
                
                if (name && name.length > 5 && name.length < 100 && !name.includes('http')) {
                  places.push({
                    name,
                    description: description.substring(0, 200),
                    type: 'event',
                    details: `Happening around ${dayOfWeek}`,
                  });
                  
                  if (places.length >= 10) break;
                }
              }
            }
          }
          
          if (places.length >= 10) break;
        }
      }
    } catch (error) {
      console.error(`[Scraping] Event site failed: ${url}`, error);
    }
  }

  // Deduplicate by name
  const uniquePlaces = Array.from(
    new Map(places.map(p => [p.name.toLowerCase(), p])).values()
  );

  return uniquePlaces.slice(0, 10);
}

/**
 * Scrape event-specific sources for real events on the date
 */
async function scrapeEventSources(
  destination: string,
  date: Date,
  keywords: string[]
): Promise<ScrapedPlace[]> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) return [];

  const places: ScrapedPlace[] = [];
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Try multiple event sources
  const eventSources = [
    // Eventbrite
    `https://www.eventbrite.com/d/${destination.toLowerCase().replace(/\s+/g, '-')}/events--${keywords.join('-')}`,
    // SeatGeek for sports
    `https://seatgeek.com/${destination.toLowerCase().replace(/\s+/g, '-')}-tickets`,
  ];

  for (const url of eventSources) {
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
          timeout: 8000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.data?.markdown || '';
        
        // Extract events that mention the specific date
        const lines = content.split('\n');
        for (const line of lines) {
          // Look for event patterns with dates
          if (line.includes(dateStr) || line.includes(date.toLocaleDateString('en-US', { weekday: 'long' }))) {
            // Extract event name before the date
            const eventMatch = line.match(/(.+?)\s*[-–]\s*.*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            if (eventMatch) {
              const eventName = eventMatch[1].trim();
              if (eventName.length > 5 && eventName.length < 100) {
                places.push({
                  name: eventName,
                  description: `Event on ${dateStr}`,
                  type: 'event',
                  details: `Verified event on ${dateStr}`,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[Scraping] Event source failed:', url, error);
    }
  }

  return places;
}

/**
 * Regenerate a single day based on user's natural language prompt
 */
export async function regenerateDay(
  supabase: SupabaseClient,
  input: RegenerateDayInput
): Promise<Activity[]> {
  const { itineraryId, dayId, dayNumber, date, destination, userPrompt, preferences, mode = 'fast' } = input;

  // Get current activities for context
  const { data: currentActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');

  const currentActivitiesText = currentActivities
    ?.map(a => `- ${a.title}: ${a.description}`)
    .join('\n') || 'No activities yet';

  let newActivities: Array<{
    name: string;
    description: string;
    locationName?: string;
    category: string;
    duration?: number;
    estimatedCost?: number;
  }> = [];

  if (mode === 'credible') {
    // CREDIBLE MODE: Use agentic researcher for real data
    console.log('[Day Regeneration] Using CREDIBLE mode with agentic researcher...');
    const startTime = Date.now();

    try {
      // STEP 1: Analyze the user prompt to understand what they want
      console.log('[Day Regeneration] Analyzing user intent...');
      const intentAnalysis = await analyzeUserIntent(userPrompt, preferences);
      console.log('[Day Regeneration] Intent:', intentAnalysis);

      // STEP 2: Use the full agentic researcher for comprehensive scraping
      const { runAgenticResearcher } = await import('@/lib/ai/agents/agentic-researcher');
      
      console.log('[Day Regeneration] Running agentic researcher...');
      const researchResult = await runAgenticResearcher({
        destination,
        preferences: {
          ...preferences,
          // Boost categories based on user intent
          activityTypes: [...intentAnalysis.categories, ...preferences.activityTypes],
        },
      });

      console.log(`[Day Regeneration] Research completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log(`[Day Regeneration] Found ${researchResult.result.attractions.length} attractions, ${researchResult.result.restaurants.length} restaurants, ${researchResult.result.activities.length} activities`);

      // STEP 3: Also do targeted date-aware scraping for events
      console.log('[Day Regeneration] Doing additional date-aware event scraping...');
      const eventData = await scrapeTargetedData(destination, intentAnalysis, date);
      console.log(`[Day Regeneration] Found ${eventData.length} date-specific events`);

      // STEP 3.5: If no specific events found, search for ANY events on that date
      if (eventData.length === 0) {
        console.log('[Day Regeneration] No specific events found, searching for ANY events on this date...');
        const anyEvents = await scrapeAnyEventsOnDate(destination, date);
        console.log(`[Day Regeneration] Found ${anyEvents.length} general events on this date`);
        eventData.push(...anyEvents);
      }

      // Combine agentic research with targeted event data
      const allPlaces = [
        ...eventData, // Prioritize date-specific events
        ...researchResult.result.attractions.map(a => ({
          name: a.name,
          description: a.description,
          type: a.category,
          details: `${a.priceRange}, ${a.estimatedDuration}min`,
        })),
        ...researchResult.result.restaurants.map(r => ({
          name: r.name,
          description: r.cuisine.join(', '),
          type: 'food',
          details: r.priceRange,
        })),
        ...researchResult.result.activities.map(a => ({
          name: a.name,
          description: a.description,
          type: a.category,
          details: `${a.duration}min`,
        })),
      ];

      // Build AI prompt with REAL scraped data from agentic researcher + targeted events
      const systemPrompt = `You are a travel planning AI. Generate activities for a single day using REAL places from agentic research and targeted web scraping.

Destination: ${destination}
Day: ${dayNumber}
Date: ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

User Preferences:
- Activities: ${preferences.activityTypes.slice(0, 5).join(', ')}
- Cuisine: ${preferences.cuisinePreferences.slice(0, 3).join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}

REAL PLACES (from agentic researcher + date-aware scraping):
${allPlaces.length > 0 
  ? allPlaces.slice(0, 30).map(item => `- ${item.name}: ${item.description} (${item.type}${item.details ? ', ' + item.details : ''})`).join('\n')
  : `⚠️ No specific data was scraped. Use your knowledge of ${destination} to suggest:
- Popular nightclubs and bars (if user wants nightlife)
- Sports venues and arenas (if user wants sports)
- Comedy clubs and entertainment venues (if user wants shows)
- Well-known restaurants and cafes
- Famous attractions and landmarks

Be specific with venue names and addresses.`
}

Current Activities:
${currentActivitiesText}

User's Request: "${userPrompt}"
User's Intent: ${intentAnalysis.specificRequests.join(', ')}

CRITICAL RULES:
1. PREFER places from the list above, but you can suggest other well-known venues if needed
2. You MUST address ALL parts of the user's request: ${intentAnalysis.specificRequests.map((r, i) => `${i + 1}. ${r}`).join(', ')}
3. For EVENTS (sports games, concerts, etc.):
   - If the specific event type requested isn't available, suggest ALTERNATIVE events from the list
   - Example: User wants sports but only concerts available → Suggest the concert as an alternative
   - If no events at all, suggest VENUES where events typically happen
   - Example: "Check Oracle Park for Giants games" or "Visit Chase Center for Warriors games"
   - Include note: "Check schedule closer to date" or "Alternative event suggestion"
4. For VENUES (clubs, bars, restaurants):
   - These can be suggested anytime as they're always open
   - Use real places from the list when available
5. If scraped data is limited, use your knowledge of popular ${destination} venues
6. PRIORITIZE: Real events from list > Alternative events > Venues > AI knowledge

Generate 3-6 activities that match the user's COMPLETE request using ONLY the real places provided.

Return ONLY valid JSON in this exact format:
{
  "activities": [
    {
      "name": "Event/Venue name from the list above",
      "description": "Brief description. If alternative event, mention: 'Alternative to [original request]'",
      "locationName": "Location from the data or the name",
      "category": "food|attraction|activity|shopping|entertainment|relaxation|event",
      "duration": 60,
      "estimatedCost": 25
    }
  ]
}

EXAMPLE when user wants sports but concert available:
{
  "activities": [
    {
      "name": "Concert at Chase Center",
      "description": "Alternative to sports game - Live music event. Check schedule for specific performers.",
      "locationName": "Chase Center",
      "category": "entertainment",
      "duration": 180,
      "estimatedCost": 75
    }
  ]
}`;

      const aiStartTime = Date.now();
      const result = await generateText({
        model: openai('gpt-4o'),
        prompt: systemPrompt,
        temperature: 0.7,
      });

      console.log(`[Day Regeneration] AI synthesis completed in ${((Date.now() - aiStartTime) / 1000).toFixed(1)}s`);

      // Parse response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      newActivities = parsed.activities || [];

      if (newActivities.length === 0) {
        throw new Error('No activities generated');
      }

      console.log(`[Day Regeneration] CREDIBLE mode completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s total`);
    } catch (error) {
      console.error('[Day Regeneration] Credible mode failed, falling back to fast mode:', error);
      // Fall back to fast mode if credible mode fails
      newActivities = await generateFastMode(destination, dayNumber, date, preferences, userPrompt, currentActivitiesText);
    }
  } else {
    // FAST MODE: Pure AI generation
    console.log('[Day Regeneration] Using FAST mode (AI-only)...');
    newActivities = await generateFastMode(destination, dayNumber, date, preferences, userPrompt, currentActivitiesText);
  }

  // Delete old activities
  await supabase.from('activities').delete().eq('day_id', dayId);

  // Insert new activities
  const activitiesToInsert = newActivities.map((act, index) => ({
    day_id: dayId,
    title: act.name || 'Activity',
    description: act.description || '',
    location_name: act.locationName || act.name,
    category: act.category || 'activity',
    estimated_cost: act.estimatedCost || null,
    sort_order: index + 1,
    notes: `Regenerated (${mode} mode): "${userPrompt}"`,
  }));

  const { data: insertedActivities, error: insertError } = await supabase
    .from('activities')
    .insert(activitiesToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to save activities: ${insertError.message}`);
  }

  // Update itinerary's updated_at timestamp
  await supabase
    .from('itineraries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itineraryId);

  console.log(`[Day Regeneration] Successfully regenerated ${insertedActivities.length} activities`);

  return insertedActivities.map(act => ({
    id: act.id,
    title: act.title,
    description: act.description,
    locationName: act.location_name,
    category: act.category,
    estimatedCost: act.estimated_cost,
    sortOrder: act.sort_order,
    notes: act.notes,
  }));
}

/**
 * Fast mode generation helper
 */
async function generateFastMode(
  destination: string,
  dayNumber: number,
  date: Date,
  preferences: UserPreferences,
  userPrompt: string,
  currentActivitiesText: string
): Promise<Array<{
  name: string;
  description: string;
  locationName?: string;
  category: string;
  duration?: number;
  estimatedCost?: number;
}>> {
  const systemPrompt = `You are a travel planning AI. Generate activities for a single day of travel based on the user's request.

Destination: ${destination}
Day: ${dayNumber}
Date: ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

User Preferences:
- Activities: ${preferences.activityTypes.slice(0, 5).join(', ')}
- Cuisine: ${preferences.cuisinePreferences.slice(0, 3).join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}
- Interests: ${preferences.culturalInterests.slice(0, 3).join(', ')}

Current Activities:
${currentActivitiesText}

User's Request: "${userPrompt}"

Generate 3-6 activities for this day that match the user's request. Include specific location names/addresses so they can be shown on a map.

Return ONLY valid JSON in this exact format:
{
  "activities": [
    {
      "name": "Activity Name",
      "description": "Brief description",
      "locationName": "Specific address or location name",
      "category": "food|attraction|activity|shopping|entertainment|relaxation",
      "duration": 60,
      "estimatedCost": 25
    }
  ]
}`;

  console.log('[Day Regeneration] Calling AI with prompt:', userPrompt);
  const startTime = Date.now();

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: systemPrompt,
    temperature: 0.8,
  });

  console.log(`[Day Regeneration] AI completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Parse response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.activities || [];
}
