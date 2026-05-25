/**
 * Itinerary Generator Service
 * 
 * This is the main orchestrator that:
 * 1. Uses Multi-Agent System (Research → Plan → Review loop)
 * 2. OR falls back to local pipeline if AI fails
 * 3. Saves the result to the database
 * 
 * Multi-Agent Architecture:
 * - Research Agent: Gathers destination data via Tavily search
 * - Planner Agent: Creates day-by-day itineraries
 * - Reviewer Agent: Validates and improves plans
 * - Orchestrator: Coordinates agents with autonomous loops
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences } from '@/types/quiz';
import { fetchDestinationData } from './tavily-service';
import { runOrchestrator, OrchestratorOutput } from './agents/orchestrator';
import { runAgenticOrchestrator, AgenticOrchestratorOutput } from './agents/agentic-orchestrator';
import { ItineraryPlan, ScheduledItem } from './agents/types';
import type { Attraction, Restaurant, ActivityOption } from '@/types/destination';

// ---------------------------------------------------------------------------
// Local shape used by this service and the persistence layer.
// (Kept local because agents/types.ts uses a different day shape — morning /
// afternoon / evening buckets — whereas we normalise to a flat activity list.)
// ---------------------------------------------------------------------------

/** Recommendation as produced by the generator, before database persistence. */
export interface ActivityRecommendation {
  type: 'attraction' | 'restaurant' | 'activity';
  item: Attraction | Restaurant | ActivityOption;
  matchScore: number;
  matchReasons: string[];
  suggestedTimeSlot: 'morning' | 'afternoon' | 'evening';
  suggestedDuration: number;
}

/** Normalised per-day plan used throughout this service. */
export interface DayPlan {
  id?: string;
  dayNumber: number;
  date: Date;
  activities: ActivityRecommendation[];
  totalDuration?: number;
  notes: string;
}

// Helper interface for database operations
interface SimpleActivity {
  id?: string;
  title: string;
  description: string;
  locationName: string;
  category: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  estimatedCost?: number;
  sortOrder: number;
  notes: string;
}

export interface ItineraryInput {
  userId: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  title?: string;
  activityDensity?: 'relaxed' | 'moderate' | 'packed';
}

export interface GeneratedItinerary {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  days: DayPlan[];
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: Date;
}

export interface ProgressCallback {
  (data: { status: string; message: string; progress?: number }): void;
}

/**
 * Generate a complete personalized itinerary
 * Uses Sim Studio workflow if configured, otherwise falls back to local pipeline
 */
export async function generateItinerary(
  supabase: SupabaseClient,
  input: ItineraryInput,
  preferences: UserPreferences,
  useAgenticMode: boolean = false,
  useTrulyAgentic: boolean = false, // NEW: Use the truly agentic system
  useAdvancedCuration: boolean = false, // NEW: Use advanced curation (extensive scraping + iterations)
  onProgress?: ProgressCallback // NEW: Progress callback for streaming
): Promise<GeneratedItinerary> {
  const { userId, destination, startDate, endDate, title, activityDensity = 'moderate' } = input;
  
  // Calculate trip duration
  const tripDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  if (tripDuration < 1 || tripDuration > 30) {
    throw new Error('Trip duration must be between 1 and 30 days');
  }

  let dayPlans: DayPlan[];
  let orchestratorResult: OrchestratorOutput | AgenticOrchestratorOutput | undefined;

  if (useTrulyAgentic) {
    // TRULY AGENTIC MODE: Full reasoning, adaptive stopping, dynamic tool selection
    console.log('[TIMING] Starting TRULY AGENTIC System...');
    console.log('Features: Dynamic tool selection, reasoning chains, adaptive stopping');
    onProgress?.({ status: 'researching', message: 'Researching destination...', progress: 10 });
    const startTime = Date.now();
    
    try {
      const agenticResult = await runAgenticOrchestrator({
        destination,
        startDate,
        endDate,
        preferences,
        qualityThreshold: useAdvancedCuration ? 85 : 60, // Higher threshold for advanced mode
        maxIterations: useAdvancedCuration ? 5 : 1, // More iterations for advanced mode
        useAdvancedCuration, // Pass flag to enable extensive scraping
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
          
          // Map internal status to user-friendly messages
          const statusMap: Record<string, { message: string; progress: number }> = {
            'researching': { message: 'Researching top attractions and hidden gems...', progress: 20 },
            'planning': { message: 'Creating your personalized itinerary...', progress: 50 },
            'reviewing': { message: 'Optimizing your schedule...', progress: 70 },
            'complete': { message: 'Finalizing details...', progress: 90 },
          };
          
          const mapped = statusMap[state.status] || { message: 'Processing...', progress: 40 };
          onProgress?.({ status: state.status, message: mapped.message, progress: mapped.progress });
          
          if (state.reasoning && state.reasoning.length > 0) {
            const latest = state.reasoning[state.reasoning.length - 1];
            console.log(`  [${latest.agent}] ${latest.thought}`);
          }
        },
      });

      console.log(`[TIMING] Truly Agentic System completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (agenticResult.success && agenticResult.plan) {
        dayPlans = convertAgentPlanToDayPlans(agenticResult.plan, startDate);
        
        console.log('Truly Agentic orchestration complete');
        console.log(`Final score: ${agenticResult.finalScore}/100`);
        console.log(`Iterations: ${agenticResult.iterations}`);
        console.log(`Reasoning steps: ${agenticResult.reasoning.length}`);
        console.log('\nReasoning Chain:');
        agenticResult.reasoning.forEach((step, i) => {
          console.log(`${i + 1}. [${step.agent}] ${step.thought} -> ${step.action} -> ${step.result}`);
        });
      } else {
        console.warn('Truly Agentic system failed, falling back to local pipeline');
        onProgress?.({ status: 'fallback', message: 'Using alternative generation...', progress: 50 });
        dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
      }
    } catch (error) {
      console.error('Truly Agentic error:', error);
      onProgress?.({ status: 'fallback', message: 'Using fallback generation...', progress: 50 });
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
    }
  } else {
    // Standard Multi-Agent System (Agentic Mode)
    console.log('[TIMING] Starting Multi-Agent System (Agentic Mode)...');
    onProgress?.({ status: 'researching', message: 'Researching destination...', progress: 15 });
    const startTime = Date.now();
    console.log('Agents: Research → Plan → Review (with autonomous loops)');
    
    try {
      orchestratorResult = await runOrchestrator({
        destination,
        startDate,
        endDate,
        preferences,
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
          
          // Map internal status to user-friendly messages
          const statusMap: Record<string, { message: string; progress: number }> = {
            'researching': { message: 'Finding the best local restaurants...', progress: 25 },
            'planning': { message: 'Mapping optimal routes and neighborhoods...', progress: 50 },
            'reviewing': { message: 'Checking opening hours and availability...', progress: 70 },
            'complete': { message: 'Personalizing based on your preferences...', progress: 85 },
          };
          
          const mapped = statusMap[state.status] || { message: 'Processing...', progress: 40 };
          onProgress?.({ status: state.status, message: mapped.message, progress: mapped.progress });
        },
      });

      console.log(`[TIMING] Multi-Agent System completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (orchestratorResult.success && orchestratorResult.plan) {
        dayPlans = convertAgentPlanToDayPlans(orchestratorResult.plan, startDate);
        
        console.log('Multi-Agent orchestration complete!');
        console.log(`Final score: ${orchestratorResult.state.review?.score || 'N/A'}/100`);
        console.log(`Iterations: ${orchestratorResult.state.iteration}`);
      } else {
        console.warn('Multi-Agent system failed, falling back to local pipeline:', orchestratorResult.error);
        onProgress?.({ status: 'fallback', message: 'Using alternative generation...', progress: 50 });
        dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
      }
    } catch (error) {
      console.error('Multi-Agent error:', error);
      onProgress?.({ status: 'fallback', message: 'Using fallback generation...', progress: 50 });
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
    }
  }

  // Save to database
  onProgress?.({ status: 'saving', message: 'Saving your itinerary...', progress: 95 });
  return await saveItineraryToDatabase(supabase, {
    userId,
    title: title || `Trip to ${destination}`,
    destination,
    startDate,
    endDate,
    dayPlans,
    preferences,
  });
}

/**
 * Convert multi-agent ItineraryPlan to our DayPlan format
 */
function convertAgentPlanToDayPlans(plan: ItineraryPlan, startDate: Date): DayPlan[] {
  return plan.days.map((day, index) => {
    const allItems: ScheduledItem[] = [
      ...day.morning,
      ...day.afternoon,
      ...day.evening,
    ];

    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + index);

    // Convert to ActivityRecommendation format
    const activities: ActivityRecommendation[] = allItems.map((item, i) => ({
      type: (item.type === 'restaurant' ? 'restaurant' : item.type === 'attraction' ? 'attraction' : 'activity') as 'attraction' | 'restaurant' | 'activity',
      item: {
        name: item.name,
        description: item.description || '',
        category: item.type || 'activity',
      } as any, // Type assertion to avoid complex type issues
      matchScore: 80,
      matchReasons: item.matchReasons || [],
      suggestedTimeSlot: i < allItems.length / 3 ? 'morning' : i < (2 * allItems.length) / 3 ? 'afternoon' : 'evening',
      suggestedDuration: item.duration || 90,
    }));

    return {
      dayNumber: day.dayNumber,
      date: dayDate,
      activities,
      totalDuration: allItems.reduce((sum, item) => sum + (item.duration || 0), 0),
      notes: day.notes || (day.theme ? `Theme: ${day.theme}` : ''),
    };
  });
}

/**
 * Convert ActivityRecommendation to SimpleActivity for database
 */
function activityToSimple(activity: ActivityRecommendation, index: number): SimpleActivity {
  // These three shapes have overlapping fields; narrow to the ones we use.
  const item = activity.item as {
    name?: string;
    description?: string;
    address?: string;
    cuisine?: string[];
    priceRange?: string;
  };

  // Prefer the real address if research returned one. Falls back to the name
  // so the map still geocodes correctly. Never echo the title verbatim —
  // that's what was causing "Lunch at Nathan's / Lunch at Nathan's".
  const locationName = item.address?.trim() || item.name || '';

  // If there's no description (common for restaurants), synthesise a short
  // one from cuisine + price so the card has something useful under the title.
  let description = item.description || '';
  if (!description && item.cuisine && item.cuisine.length > 0) {
    description = `${item.cuisine.join(', ')} · ${item.priceRange || ''}`.trim();
  }

  return {
    title: item.name || '',
    description,
    locationName,
    category: activity.type || 'activity',
    startTime: undefined,
    endTime: undefined,
    duration: activity.suggestedDuration || undefined,
    estimatedCost: undefined,
    sortOrder: index + 1,
    notes: activity.matchReasons?.join(', ') || '',
  };
}

function getTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Local fallback pipeline used when the agentic systems fail. Uses whatever
 * the research layer returns and slots items into a light time-of-day schedule.
 */
async function generateLocalItinerary(
  destination: string,
  tripDuration: number,
  preferences: UserPreferences,
  startDate: Date,
  activityDensity: 'relaxed' | 'moderate' | 'packed' = 'moderate'
): Promise<DayPlan[]> {
  console.log(`Fetching destination data for ${destination}...`);
  const data = await fetchDestinationData(destination);

  const perDay =
    activityDensity === 'relaxed' ? 3 : activityDensity === 'packed' ? 7 : 5;

  // Simple preference-aware sort: anything whose category is in the user's
  // preferred activity types or cuisine list gets a small boost.
  const preferred = new Set([
    ...(preferences.activityTypes ?? []),
    ...(preferences.cuisinePreferences ?? []),
  ]);

  const score = (category: string) => (preferred.has(category) ? 1 : 0);

  const attractionPool: ActivityRecommendation[] = (data.attractions ?? [])
    .slice()
    .sort((a, b) => score(b.category) - score(a.category))
    .map((item) => ({
      type: 'attraction' as const,
      item,
      matchScore: 70 + score(item.category) * 15,
      matchReasons: preferred.has(item.category) ? ['Matches your preferences'] : [],
      suggestedTimeSlot: 'morning' as const,
      suggestedDuration: item.estimatedDuration ?? 120,
    }));

  const restaurantPool: ActivityRecommendation[] = (data.restaurants ?? [])
    .slice()
    .sort((a, b) => {
      const aScore = Math.max(0, ...a.cuisine.map(score));
      const bScore = Math.max(0, ...b.cuisine.map(score));
      return bScore - aScore;
    })
    .map((item) => {
      const matches = item.cuisine.some((c) => preferred.has(c));
      return {
        type: 'restaurant' as const,
        item,
        matchScore: 70 + (matches ? 15 : 0),
        matchReasons: matches ? ['Matches your cuisine preferences'] : [],
        suggestedTimeSlot: 'afternoon' as const,
        suggestedDuration: 90,
      };
    });

  const activityPool: ActivityRecommendation[] = (data.activities ?? []).map(
    (item) => ({
      type: 'activity' as const,
      item,
      matchScore: 70 + score(item.category) * 15,
      matchReasons: preferred.has(item.category) ? ['Matches your preferences'] : [],
      suggestedTimeSlot: 'evening' as const,
      suggestedDuration: item.duration ?? 120,
    })
  );

  const days: DayPlan[] = [];
  let attractionIdx = 0;
  let restaurantIdx = 0;
  let activityIdx = 0;

  const pick = (
    pool: ActivityRecommendation[],
    idxRef: { i: number },
    slot: ActivityRecommendation['suggestedTimeSlot']
  ): ActivityRecommendation | null => {
    if (pool.length === 0) return null;
    const item = pool[idxRef.i % pool.length];
    idxRef.i += 1;
    return { ...item, suggestedTimeSlot: slot };
  };

  for (let d = 0; d < tripDuration; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    const attractionRef = { i: attractionIdx };
    const restaurantRef = { i: restaurantIdx };
    const activityRef = { i: activityIdx };

    const activities: ActivityRecommendation[] = [];
    // Rotate attraction / restaurant / activity slots until we hit perDay.
    const slotOrder: ActivityRecommendation['suggestedTimeSlot'][] = [
      'morning',
      'afternoon',
      'evening',
    ];
    for (let i = 0; i < perDay; i++) {
      const slot = slotOrder[i % 3];
      let next: ActivityRecommendation | null = null;
      if (slot === 'afternoon') next = pick(restaurantPool, restaurantRef, slot);
      if (!next && slot === 'evening') next = pick(activityPool, activityRef, slot);
      if (!next) next = pick(attractionPool, attractionRef, slot);
      if (!next) break;
      activities.push(next);
    }

    attractionIdx = attractionRef.i;
    restaurantIdx = restaurantRef.i;
    activityIdx = activityRef.i;

    days.push({
      dayNumber: d + 1,
      date,
      activities,
      totalDuration: activities.reduce((sum, a) => sum + a.suggestedDuration, 0),
      notes: `Day ${d + 1} in ${destination}`,
    });
  }

  return days;
}

/**
 * Save itinerary and activities to database
 */
async function saveItineraryToDatabase(
  supabase: SupabaseClient,
  data: {
    userId: string;
    title: string;
    destination: string;
    startDate: Date;
    endDate: Date;
    dayPlans: DayPlan[];
    preferences: UserPreferences;
  }
): Promise<GeneratedItinerary> {
  const { userId, title, destination, startDate, endDate, dayPlans, preferences } = data;

  // Create itinerary record
  const { data: itinerary, error: itineraryError } = await supabase
    .from('itineraries')
    .insert({
      user_id: userId,
      title,
      destination,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'draft',
      preferences_snapshot: preferences,
    })
    .select()
    .single();

  if (itineraryError) {
    throw new Error(`Failed to create itinerary: ${itineraryError.message}`);
  }

  // Create day records
  for (const dayPlan of dayPlans) {
    const { data: day, error: dayError } = await supabase
      .from('itinerary_days')
      .insert({
        itinerary_id: itinerary.id,
        day_number: dayPlan.dayNumber,
        date: dayPlan.date.toISOString().split('T')[0],
        notes: dayPlan.notes,
      })
      .select()
      .single();

    if (dayError) {
      throw new Error(`Failed to create day: ${dayError.message}`);
    }

    // Create activity records for this day
    for (let i = 0; i < dayPlan.activities.length; i++) {
      const activity = dayPlan.activities[i];
      const simpleActivity = activityToSimple(activity, i);

      const activityData = {
        day_id: day.id,
        title: simpleActivity.title,
        description: simpleActivity.description,
        location_name: simpleActivity.locationName,
        category: simpleActivity.category,
        start_time: simpleActivity.startTime || null,
        end_time: simpleActivity.endTime || null,
        duration: simpleActivity.duration || null,
        estimated_cost: simpleActivity.estimatedCost || null,
        sort_order: simpleActivity.sortOrder,
        notes: simpleActivity.notes,
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert(activityData);

      if (activityError) {
        console.error('Failed to create activity:', activityError);
      }
    }
  }

  return {
    id: itinerary.id,
    userId: itinerary.user_id,
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: new Date(itinerary.start_date),
    endDate: new Date(itinerary.end_date),
    days: dayPlans,
    status: itinerary.status,
    createdAt: new Date(itinerary.created_at),
  };
}

/**
 * Get an existing itinerary with all its days and activities
 */
export async function getItinerary(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<GeneratedItinerary | null> {
  const { data: itinerary, error } = await supabase
    .from('itineraries')
    .select(`
      *,
      itinerary_days (
        *,
        activities (*)
      )
    `)
    .eq('id', itineraryId)
    .single();

  if (error || !itinerary) {
    return null;
  }

  const days: DayPlan[] = itinerary.itinerary_days
    .sort((a: { day_number: number }, b: { day_number: number }) => a.day_number - b.day_number)
    .map((day: { id: string; day_number: number; date: string; activities: Array<{ id: string; title: string; description: string; category: string; sort_order: number; notes: string; location_name?: string; estimated_cost?: number }>; notes: string }) => ({
      id: day.id,
      dayNumber: day.day_number,
      date: new Date(day.date),
      notes: day.notes || '',
      activities: day.activities
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((act: { id: string; title: string; description: string; category: string; start_time?: string; end_time?: string; duration?: number; sort_order: number; notes: string; location_name?: string; estimated_cost?: number }) => ({
          id: act.id,
          title: act.title,
          description: act.description,
          locationName: act.location_name,
          category: act.category,
          startTime: act.start_time,
          endTime: act.end_time,
          duration: act.duration,
          estimatedCost: act.estimated_cost,
          sortOrder: act.sort_order,
          notes: act.notes,
        })),
    }));

  return {
    id: itinerary.id,
    userId: itinerary.user_id,
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: new Date(itinerary.start_date),
    endDate: new Date(itinerary.end_date),
    days,
    status: itinerary.status,
    createdAt: new Date(itinerary.created_at),
  };
}

/**
 * List all itineraries for a user
 */
export async function listItineraries(
  supabase: SupabaseClient,
  userId: string
): Promise<GeneratedItinerary[]> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list itineraries: ${error.message}`);
  }

  return data.map((it: Record<string, string>) => ({
    id: it.id,
    userId: it.user_id,
    title: it.title,
    destination: it.destination,
    startDate: new Date(it.start_date),
    endDate: new Date(it.end_date),
    days: [],
    status: it.status as GeneratedItinerary['status'],
    createdAt: new Date(it.created_at),
  }));
}


/**
 * Regenerate an itinerary with variation
 * Updates the existing itinerary with new activities while respecting preferences
 */
export async function regenerateItinerary(
  supabase: SupabaseClient,
  itineraryId: string,
  options?: {
    excludeActivities?: string[]; // Activity names to avoid
    focusAreas?: string[]; // Areas to emphasize (e.g., 'food', 'culture')
    useAgenticMode?: boolean; // Use full multi-agent system
    useTrulyAgentic?: boolean; // Use truly agentic system with reasoning
  }
): Promise<GeneratedItinerary> {
  // Get existing itinerary
  const existing = await getItinerary(supabase, itineraryId);
  if (!existing) {
    throw new Error('Itinerary not found');
  }

  // Get user preferences
  const { data: prefsData, error: prefsError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', existing.userId)
    .single();

  if (prefsError || !prefsData) {
    throw new Error('User preferences not found');
  }

  const preferences: UserPreferences = {
    id: prefsData.id,
    userId: prefsData.user_id,
    travelMotivations: prefsData.travel_motivations || [],
    planningStyle: prefsData.planning_style || 'structured_flexible',
    authenticityPreference: prefsData.authenticity_preference || 'balanced',
    timeRhythm: prefsData.time_rhythm || 'steady_daytime',
    comfortZone: prefsData.comfort_zone || 5,
    activityTypes: prefsData.activity_types || [],
    cuisinePreferences: prefsData.cuisine_preferences || [],
    budgetRange: prefsData.budget_range || 'moderate',
    travelPace: prefsData.travel_pace || 'moderate',
    socialPreferences: prefsData.social_preferences || 'solo',
    rawAnswers: prefsData.raw_answers || {},
    createdAt: new Date(prefsData.created_at),
    updatedAt: new Date(prefsData.updated_at),
  };

  // Modify preferences based on options to get variation
  const modifiedPreferences = { ...preferences };
  
  if (options?.focusAreas?.length) {
    // Boost certain activity types
    modifiedPreferences.activityTypes = [
      ...options.focusAreas,
      ...preferences.activityTypes.filter(t => !options.focusAreas!.includes(t)),
    ];
  }

  // Calculate trip duration
  const tripDuration = Math.ceil(
    (existing.endDate.getTime() - existing.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  let dayPlans: DayPlan[];
  let orchestratorResult: OrchestratorOutput | AgenticOrchestratorOutput | undefined;

  // Always use agentic mode for regeneration
  const useTrulyAgentic = options?.useTrulyAgentic ?? true;
  const useAgenticMode = options?.useAgenticMode ?? true;

  if (useTrulyAgentic) {
    // Truly Agentic System for regeneration
    console.log('[TIMING] Regenerating with Truly Agentic System...');
    const startTime = Date.now();
    
    try {
      const agenticResult = await runAgenticOrchestrator({
        destination: existing.destination,
        startDate: existing.startDate,
        endDate: existing.endDate,
        preferences: modifiedPreferences,
        qualityThreshold: 60, // Accept anything above 60 for speed
        maxIterations: 1, // Just 1 iteration for speed
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
        },
      });

      console.log(`[TIMING] Truly Agentic regeneration completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (agenticResult.success && agenticResult.plan) {
        console.log('DEBUG: Agentic result plan:', JSON.stringify(agenticResult.plan, null, 2));
        dayPlans = convertAgentPlanToDayPlans(agenticResult.plan, existing.startDate);
        console.log(`DEBUG: Converted to ${dayPlans.length} day plans`);
        console.log('DEBUG: First day:', JSON.stringify(dayPlans[0], null, 2));
        console.log(`Regeneration score: ${agenticResult.finalScore}/100`);
        console.log(`Iterations: ${agenticResult.iterations}`);
        console.log(`Generated ${dayPlans.length} days with ${dayPlans.reduce((sum, d) => sum + d.activities.length, 0)} total activities`);
        console.log('\nReasoning Chain:');
        agenticResult.reasoning.forEach((step, i) => {
          console.log(`${i + 1}. [${step.agent}] ${step.thought}`);
          console.log(`   -> ${step.action}`);
          console.log(`   -> ${step.result}`);
        });
      } else {
        console.error('DEBUG: Agentic result failed or no plan:', agenticResult);
        console.warn('Truly Agentic regeneration failed, falling back to local pipeline');
        dayPlans = await generateLocalItinerary(
          existing.destination,
          tripDuration,
          modifiedPreferences,
          existing.startDate
        );
      }
    } catch (error) {
      console.error('Truly Agentic regeneration error:', error);
      dayPlans = await generateLocalItinerary(
        existing.destination,
        tripDuration,
        modifiedPreferences,
        existing.startDate
      );
    }
  } else if (useAgenticMode) {
    // Full Multi-Agent System for regeneration
    console.log('[TIMING] Regenerating with Multi-Agent System (Agentic Mode)...');
    const startTime = Date.now();
    
    try {
      orchestratorResult = await runOrchestrator({
        destination: existing.destination,
        startDate: existing.startDate,
        endDate: existing.endDate,
        preferences: modifiedPreferences,
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
        },
      });

      console.log(`[TIMING] Multi-Agent regeneration completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (orchestratorResult.success && orchestratorResult.plan) {
        dayPlans = convertAgentPlanToDayPlans(orchestratorResult.plan, existing.startDate);
        console.log(`Regeneration score: ${orchestratorResult.state.review?.score || 'N/A'}/100`);
      } else {
        console.warn('Multi-Agent regeneration failed, falling back to local pipeline');
        dayPlans = await generateLocalItinerary(
          existing.destination,
          tripDuration,
          modifiedPreferences,
          existing.startDate
        );
      }
    } catch (error) {
      console.error('Multi-Agent regeneration error:', error);
      dayPlans = await generateLocalItinerary(
        existing.destination,
        tripDuration,
        modifiedPreferences,
        existing.startDate
      );
    }
  } else {
    // Fallback: use local pipeline
    dayPlans = await generateLocalItinerary(
      existing.destination,
      tripDuration,
      modifiedPreferences,
      existing.startDate
    );
  }

  // Delete existing days and activities
  const { data: existingDays } = await supabase
    .from('itinerary_days')
    .select('id')
    .eq('itinerary_id', itineraryId);

  if (existingDays) {
    for (const day of existingDays) {
      await supabase.from('activities').delete().eq('day_id', day.id);
    }
    await supabase.from('itinerary_days').delete().eq('itinerary_id', itineraryId);
  }

  // Update itinerary metadata
  await supabase
    .from('itineraries')
    .update({
      preferences_snapshot: modifiedPreferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itineraryId);

  // Create new day records with activities
  for (const dayPlan of dayPlans) {
    const { data: day, error: dayError } = await supabase
      .from('itinerary_days')
      .insert({
        itinerary_id: itineraryId,
        day_number: dayPlan.dayNumber,
        date: dayPlan.date.toISOString().split('T')[0],
        notes: dayPlan.notes,
      })
      .select()
      .single();

    if (dayError) {
      throw new Error(`Failed to create day: ${dayError.message}`);
    }

    // Create activity records for this day
    for (let i = 0; i < dayPlan.activities.length; i++) {
      const activity = dayPlan.activities[i];
      const simpleActivity = activityToSimple(activity, i);

      const activityData = {
        day_id: day.id,
        title: simpleActivity.title,
        description: simpleActivity.description,
        location_name: simpleActivity.locationName,
        category: simpleActivity.category,
        start_time: simpleActivity.startTime || null,
        end_time: simpleActivity.endTime || null,
        duration: simpleActivity.duration || null,
        estimated_cost: simpleActivity.estimatedCost || null,
        sort_order: simpleActivity.sortOrder,
        notes: simpleActivity.notes,
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert(activityData);

      if (activityError) {
        console.error('Failed to create activity:', activityError);
      }
    }
  }

  // Return the updated itinerary
  return {
    id: existing.id,
    userId: existing.userId,
    title: existing.title,
    destination: existing.destination,
    startDate: existing.startDate,
    endDate: existing.endDate,
    days: dayPlans,
    status: existing.status,
    createdAt: existing.createdAt,
  };
}

/**
 * Update itinerary status
 */
export async function updateItineraryStatus(
  supabase: SupabaseClient,
  itineraryId: string,
  status: 'draft' | 'active' | 'completed' | 'archived'
): Promise<void> {
  const { error } = await supabase
    .from('itineraries')
    .update({ status })
    .eq('id', itineraryId);

  if (error) {
    throw new Error(`Failed to update itinerary status: ${error.message}`);
  }
}

/**
 * Delete an itinerary and all associated data
 */
export async function deleteItinerary(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<void> {
  // Delete activities first (via cascade should work, but being explicit)
  const { data: days } = await supabase
    .from('itinerary_days')
    .select('id')
    .eq('itinerary_id', itineraryId);

  if (days) {
    for (const day of days) {
      await supabase.from('activities').delete().eq('day_id', day.id);
    }
  }

  // Delete days
  await supabase.from('itinerary_days').delete().eq('itinerary_id', itineraryId);

  // Delete itinerary
  const { error } = await supabase.from('itineraries').delete().eq('id', itineraryId);

  if (error) {
    throw new Error(`Failed to delete itinerary: ${error.message}`);
  }
}
