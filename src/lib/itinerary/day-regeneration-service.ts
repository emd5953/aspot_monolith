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
}

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  category: string;
  estimatedCost?: number;
  bookingUrl?: string;
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
  eventLink?: string;
  address?: string;
}

/**
 * Analyze user's natural language prompt to understand intent
 */
async function analyzeUserIntent(
  userPrompt: string,
  preferences: UserPreferences
): Promise<UserIntent & { action: 'add' | 'remove' | 'replace' | 'regenerate' }> {
  const analysisPrompt = `Analyze this travel request and extract structured intent:

User Request: "${userPrompt}"
User Preferences: ${preferences.activityTypes?.join(', ') || 'general activities'}

Extract:
1. Action type:
   - "add" if user wants to ADD something (e.g., "add thrifting", "include a museum")
   - "remove" if user wants to REMOVE something (e.g., "remove the beach", "skip museums")
   - "replace" if user wants to SWAP something (e.g., "replace lunch with italian", "change museum to park")
   - "regenerate" if user wants to REDO everything (e.g., "more food experiences", "completely different")

2. Keywords (important words like "clubbing", "sports", "thrift store")
3. Categories (nightlife, sports, shopping, food, etc.)
4. Search queries (what to search on Google/TripAdvisor)
5. Time of day (morning/afternoon/evening/night)
6. Specific requests (list each distinct thing they want)

Return JSON:
{
  "action": "add",
  "keywords": ["thrifting", "vintage"],
  "categories": ["shopping"],
  "searchQueries": ["best thrift stores in [destination]", "vintage shops [destination]"],
  "timeOfDay": "afternoon",
  "specificRequests": ["add thrift shopping"]
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
  const lowerPrompt = userPrompt.toLowerCase();
  let action: 'add' | 'remove' | 'replace' | 'regenerate' = 'regenerate';
  
  if (lowerPrompt.includes('add') || lowerPrompt.includes('include') || lowerPrompt.includes('also')) {
    action = 'add';
  } else if (lowerPrompt.includes('remove') || lowerPrompt.includes('skip') || lowerPrompt.includes('delete')) {
    action = 'remove';
  } else if (lowerPrompt.includes('replace') || lowerPrompt.includes('change') || lowerPrompt.includes('swap')) {
    action = 'replace';
  }

  return {
    action,
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
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) {
    console.warn('[Day-regen] TAVILY_API_KEY not set — skipping web research');
    return [];
  }

  // Lazy-load tavily and the extraction model — keeps this file's other
  // helpers independent and avoids loading the SDK when no key is set.
  const { tavily } = await import('@tavily/core');
  const client = tavily({ apiKey: TAVILY_API_KEY });

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

  // Build queries shaped by user intent. We use Tavily's native search rather
  // than the old "scrape google search results" trick, which was fragile.
  const queries = intent.searchQueries
    .map((q) => q.replace('[destination]', destination))
    .map((q) => {
      // For event-style intents add day-of-week so results lean current.
      const categoryStr = intent.categories.join(' ').toLowerCase();
      if (
        categoryStr.includes('sport') ||
        categoryStr.includes('event') ||
        q.toLowerCase().includes('event')
      ) {
        return `${q} ${dayOfWeek}`;
      }
      return q;
    })
    .slice(0, 3); // cap at 3 to keep latency + token costs sane

  console.log('[Day-regen] Tavily queries:', queries);

  // Run all searches in parallel.
  const searchResults = await Promise.all(
    queries.map(async (query) => {
      try {
        const result = await client.search(query, {
          searchDepth: 'basic',
          maxResults: 6,
          includeAnswer: false,
        });
        return { query, hits: result.results || [] };
      } catch (err) {
        console.warn(`[Day-regen] Tavily search failed for "${query}":`, err);
        return { query, hits: [] };
      }
    })
  );

  // Aggregate all hits into a single corpus and extract structured places.
  const corpusEntries: string[] = [];
  searchResults.forEach(({ query, hits }) => {
    if (hits.length === 0) return;
    corpusEntries.push(`## Results for: ${query}`);
    hits.forEach((h, i) => {
      corpusEntries.push(`[${i + 1}] ${h.title}\n${h.content}\n${h.url}`);
    });
  });

  if (corpusEntries.length === 0) return [];

  const corpus = corpusEntries.join('\n\n');

  const extractionPrompt = `Extract distinct places, venues, or events from these search results about ${destination}.

CONTEXT:
- User wants: ${intent.specificRequests.join(', ')}
- Categories: ${intent.categories.join(', ')}
- Date: ${date.toDateString()} (${dayOfWeek})

SEARCH RESULTS:
${corpus}

Return a JSON array of places. Each item:
{
  "name": string (real venue/place/event name),
  "description": string (1-2 sentences from the source),
  "type": string (matches one of: ${intent.categories.join(', ')} — or "general"),
  "address": string (optional, only if mentioned),
  "url": string (optional source link),
  "details": string (optional extra detail like rating, hours, dress code)
}

Skip generic mentions, lists like "10 best things to do" without real names, and items that aren't actually in ${destination}. Return up to 12. JSON only, no prose.`;

  try {
    const { generateText } = await import('ai');
    const { openai } = await import('@ai-sdk/openai');

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: extractionPrompt,
      temperature: 0.2,
    });

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '');
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed as ScrapedPlace[];
  } catch (err) {
    console.warn('[Day-regen] Extraction failed:', err);
    return [];
  }
}

/**
 * Regenerate a single day based on user's natural language prompt
 */
export async function regenerateDay(
  supabase: SupabaseClient,
  input: RegenerateDayInput
): Promise<Activity[]> {
  const { itineraryId, dayId, dayNumber, date, destination, userPrompt, preferences } = input;

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
    bookingUrl?: string;
  }> = [];

  // Use agentic researcher for real data
  console.log('[Day Regeneration] Using agentic researcher...');
  const startTime = Date.now();

  // STEP 1: Analyze the user prompt to understand what they want
  console.log('[Day Regeneration] Analyzing user intent...');
  const intentAnalysis = await analyzeUserIntent(userPrompt, preferences);
  console.log('[Day Regeneration] Intent:', intentAnalysis);
  console.log('[Day Regeneration] Action type:', intentAnalysis.action);

  // Handle different action types
  if (intentAnalysis.action === 'add') {
    // ADD MODE: Keep existing activities, just add new ones
    console.log('[Day Regeneration] ADD mode: Keeping existing activities and adding new ones');
    return await addActivitiesToDay(supabase, {
      itineraryId,
      dayId,
      dayNumber,
      date,
      destination,
      currentActivities: currentActivities || [],
      intentAnalysis,
      preferences,
    });
  } else if (intentAnalysis.action === 'remove') {
    // REMOVE MODE: Delete matching activities
    console.log('[Day Regeneration] REMOVE mode: Removing matching activities');
    return await removeActivitiesFromDay(supabase, {
      itineraryId,
      dayId,
      currentActivities: currentActivities || [],
      intentAnalysis,
    });
  } else if (intentAnalysis.action === 'replace') {
    // REPLACE MODE: Remove old, add new
    console.log('[Day Regeneration] REPLACE mode: Swapping activities');
    // First remove, then add
    await removeActivitiesFromDay(supabase, {
      itineraryId,
      dayId,
      currentActivities: currentActivities || [],
      intentAnalysis,
    });
    return await addActivitiesToDay(supabase, {
      itineraryId,
      dayId,
      dayNumber,
      date,
      destination,
      currentActivities: currentActivities || [],
      intentAnalysis,
      preferences,
    });
  }

  // REGENERATE MODE: Full regeneration (existing behavior)
  console.log('[Day Regeneration] REGENERATE mode: Full day regeneration');

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

  // Combine agentic research with targeted event data
  const allPlaces = [
    ...eventData, // Prioritize date-specific events
    ...researchResult.result.attractions.map(a => ({
      name: a.name,
      description: a.description,
      type: a.category,
      details: `${a.priceRange}, ${a.estimatedDuration}min`,
      eventLink: undefined,
      address: a.location,
    })),
    ...researchResult.result.restaurants.map(r => ({
      name: r.name,
      description: r.cuisine.join(', '),
      type: 'food',
      details: r.priceRange,
      eventLink: undefined,
      address: r.location,
    })),
    ...researchResult.result.activities.map(a => ({
      name: a.name,
      description: a.description,
      type: a.category,
      details: `${a.duration}min`,
      eventLink: undefined,
      address: undefined,
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
  ? allPlaces.slice(0, 30).map(item => {
      const linkInfo = item.eventLink ? ` [Link: ${item.eventLink}]` : '';
      const addressInfo = item.address ? ` [Address: ${item.address}]` : '';
      return `- ${item.name}: ${item.description} (${item.type}${item.details ? ', ' + item.details : ''})${addressInfo}${linkInfo}`;
    }).join('\n')
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
7. If a place has a [Link: URL], include that URL in the bookingUrl field
8. **CRITICAL**: If a place has [Address: ...], you MUST use that EXACT address in locationName. DO NOT make up addresses!
9. If no address is provided, use just the venue name (e.g., "Kith NYC" or "General Assembly")

Generate 3-6 activities that match the user's COMPLETE request using ONLY the real places provided.

Return ONLY valid JSON in this exact format:
{
  "activities": [
    {
      "name": "Event/Venue name from the list above",
      "description": "Brief description. If alternative event, mention: 'Alternative to [original request]'",
      "locationName": "EXACT address from [Address: ...] if provided, otherwise just venue name",
      "category": "food|attraction|activity|shopping|entertainment|relaxation|event",
      "duration": 60,
      "estimatedCost": 25,
      "bookingUrl": "URL if available from the scraped data"
    }
  ]
}

EXAMPLE when user wants sports but concert available:
{
  "activities": [
    {
      "name": "Concert at Chase Center",
      "description": "Alternative to sports game - Live music event. Check schedule for specific performers.",
      "locationName": "1 Warriors Way, San Francisco, CA 94158",
      "category": "entertainment",
      "duration": 180,
      "estimatedCost": 75,
      "bookingUrl": "https://www.chasecenter.com/events"
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

  console.log(`[Day Regeneration] Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s total`);

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
    booking_url: act.bookingUrl || null,
    sort_order: index + 1,
    notes: `Regenerated: "${userPrompt}"`,
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
    bookingUrl: act.booking_url,
    sortOrder: act.sort_order,
    notes: act.notes,
  }));
}

/**
 * Add new activities to existing day (keeps current activities)
 */
async function addActivitiesToDay(
  supabase: SupabaseClient,
  input: {
    itineraryId: string;
    dayId: string;
    dayNumber: number;
    date: Date;
    destination: string;
    currentActivities: any[];
    intentAnalysis: UserIntent & { action: string };
    preferences: UserPreferences;
  }
): Promise<Activity[]> {
  const { itineraryId, dayId, dayNumber, date, destination, currentActivities, intentAnalysis, preferences } = input;

  // Scrape data for the new activities
  const scrapedData = await scrapeTargetedData(destination, intentAnalysis, date);
  
  // Generate only the NEW activities to add
  const prompt = `You are adding activities to an existing day. DO NOT regenerate everything.

Destination: ${destination}
Day: ${dayNumber}
Date: ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

EXISTING ACTIVITIES (DO NOT CHANGE THESE):
${currentActivities.map(a => `- ${a.title}: ${a.description}`).join('\n')}

User wants to ADD: "${intentAnalysis.specificRequests.join(', ')}"

Available options from web scraping:
${scrapedData.slice(0, 10).map(p => {
  const linkInfo = p.eventLink ? ` [Link: ${p.eventLink}]` : '';
  const addressInfo = p.address ? ` [Address: ${p.address}]` : '';
  return `- ${p.name}: ${p.description}${addressInfo}${linkInfo}`;
}).join('\n')}

Generate ONLY 1-2 NEW activities to ADD to the existing day. These should match: ${intentAnalysis.specificRequests.join(', ')}

**CRITICAL**: If a place has [Address: ...], you MUST use that EXACT address in locationName. DO NOT make up addresses!

Return ONLY valid JSON:
{
  "activities": [
    {
      "name": "New Activity Name",
      "description": "Brief description",
      "locationName": "EXACT address from [Address: ...] if provided, otherwise just venue name",
      "category": "shopping|food|attraction|activity",
      "duration": 60,
      "estimatedCost": 25,
      "bookingUrl": "URL if available from the scraped data"
    }
  ]
}`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
    temperature: 0.7,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const newActivities = parsed.activities || [];

  // Insert new activities at the end
  const maxSortOrder = Math.max(...currentActivities.map(a => a.sort_order), 0);
  
  const activitiesToInsert = newActivities.map((act: any, index: number) => ({
    day_id: dayId,
    title: act.name || 'Activity',
    description: act.description || '',
    location_name: act.locationName || act.name,
    category: act.category || 'activity',
    estimated_cost: act.estimatedCost || null,
    booking_url: act.bookingUrl || null,
    sort_order: maxSortOrder + index + 1,
    notes: `Added: "${intentAnalysis.specificRequests.join(', ')}"`,
  }));

  const { data: insertedActivities, error: insertError } = await supabase
    .from('activities')
    .insert(activitiesToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to add activities: ${insertError.message}`);
  }

  // Update itinerary timestamp
  await supabase
    .from('itineraries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itineraryId);

  console.log(`[Day Regeneration] Added ${insertedActivities.length} new activities, kept ${currentActivities.length} existing`);

  // Return ALL activities (existing + new)
  const { data: allActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');

  return allActivities?.map(act => ({
    id: act.id,
    title: act.title,
    description: act.description,
    locationName: act.location_name,
    category: act.category,
    estimatedCost: act.estimated_cost,
    bookingUrl: act.booking_url,
    sortOrder: act.sort_order,
    notes: act.notes,
  })) || [];
}

/**
 * Remove activities from day based on user intent
 */
async function removeActivitiesFromDay(
  supabase: SupabaseClient,
  input: {
    itineraryId: string;
    dayId: string;
    currentActivities: any[];
    intentAnalysis: UserIntent & { action: string };
  }
): Promise<Activity[]> {
  const { itineraryId, dayId, currentActivities, intentAnalysis } = input;

  // Find activities to remove based on keywords
  const keywords = intentAnalysis.keywords.map(k => k.toLowerCase());
  const categoriesToRemove = intentAnalysis.categories.map(c => c.toLowerCase());

  const activitiesToRemove = currentActivities.filter(activity => {
    const titleLower = activity.title.toLowerCase();
    const descLower = activity.description.toLowerCase();
    const categoryLower = activity.category.toLowerCase();

    // Check if activity matches removal criteria
    return keywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword)) ||
           categoriesToRemove.includes(categoryLower);
  });

  if (activitiesToRemove.length === 0) {
    console.log('[Day Regeneration] No matching activities found to remove');
    return currentActivities.map(act => ({
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

  // Delete matching activities
  const idsToRemove = activitiesToRemove.map(a => a.id);
  await supabase
    .from('activities')
    .delete()
    .in('id', idsToRemove);

  console.log(`[Day Regeneration] Removed ${activitiesToRemove.length} activities: ${activitiesToRemove.map(a => a.title).join(', ')}`);

  // Update itinerary timestamp
  await supabase
    .from('itineraries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itineraryId);

  // Return remaining activities
  const { data: remainingActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');

  return remainingActivities?.map(act => ({
    id: act.id,
    title: act.title,
    description: act.description,
    locationName: act.location_name,
    category: act.category,
    estimatedCost: act.estimated_cost,
    bookingUrl: act.booking_url,
    sortOrder: act.sort_order,
    notes: act.notes,
  })) || [];
}
