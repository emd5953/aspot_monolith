/**
 * Itinerary Generator Service
 * 
 * This is the main orchestrator that:
 * 1. Uses Multi-Agent System (Research → Plan → Review loop)
 * 2. OR falls back to local pipeline if AI fails
 * 3. Saves the result to the database
 * 
 * Multi-Agent Architecture:
 * - Research Agent: Gathers destination data via Firecrawl
 * - Planner Agent: Creates day-by-day itineraries
 * - Reviewer Agent: Validates and improves plans
 * - Orchestrator: Coordinates agents with autonomous loops
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences } from '@/types/quiz';
import { fetchDestinationData } from './firecrawl-service';
import { generateRecommendations, buildItinerary, DayPlan } from './sim-service';
import { runOrchestrator, OrchestratorOutput } from './agents/orchestrator';
import { ItineraryPlan, ScheduledItem } from './agents/types';

export interface ItineraryInput {
  userId: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  title?: string;
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

/**
 * Generate a complete personalized itinerary
 * Uses Sim Studio workflow if configured, otherwise falls back to local pipeline
 */
export async function generateItinerary(
  supabase: SupabaseClient,
  input: ItineraryInput,
  preferences: UserPreferences
): Promise<GeneratedItinerary> {
  const { userId, destination, startDate, endDate, title } = input;
  
  // Calculate trip duration
  const tripDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  if (tripDuration < 1 || tripDuration > 30) {
    throw new Error('Trip duration must be between 1 and 30 days');
  }

  let dayPlans: DayPlan[];
  let orchestratorResult: OrchestratorOutput | undefined;

  // Try Multi-Agent System first
  if (process.env.OPENAI_API_KEY) {
    console.log('[TIMING] Starting Multi-Agent System...');
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
        },
      });

      console.log(`[TIMING] Multi-Agent System completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (orchestratorResult.success && orchestratorResult.plan) {
        // Convert multi-agent plan to our DayPlan format
        dayPlans = convertAgentPlanToDayPlans(orchestratorResult.plan, startDate);
        
        console.log('Multi-Agent orchestration complete!');
        console.log(`Final score: ${orchestratorResult.state.review?.score || 'N/A'}/100`);
        console.log(`Iterations: ${orchestratorResult.state.iteration}`);
      } else {
        console.warn('Multi-Agent system failed, falling back to local pipeline:', orchestratorResult.error);
        dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
      }
    } catch (error) {
      console.error('Multi-Agent error:', error);
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
    }
  } else {
    // Fallback: Local pipeline without AI
    console.log('OpenAI not configured, using local pipeline...');
    dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
  }

  // Save to database
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

    return {
      dayNumber: day.dayNumber,
      date: dayDate,
      activities: allItems.map((item) => ({
        type: item.type === 'restaurant' ? 'restaurant' : 
              item.type === 'attraction' ? 'attraction' : 'activity',
        item: {
          name: item.name,
          description: item.description || '',
          category: item.type,
        },
        matchScore: item.matchScore || 80,
        matchReasons: item.matchReasons || ['AI agent recommended'],
        suggestedTimeSlot: getTimeSlot(item.time),
        suggestedDuration: item.duration,
      })),
      totalDuration: allItems.reduce((sum, item) => sum + item.duration, 0),
      notes: day.notes || (day.theme ? `Theme: ${day.theme}` : ''),
    };
  });
}

function getTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Local fallback pipeline (Firecrawl + scoring)
 */
async function generateLocalItinerary(
  destination: string,
  tripDuration: number,
  preferences: UserPreferences,
  startDate: Date
): Promise<DayPlan[]> {
  // Step 1: Fetch destination data via Firecrawl
  console.log(`Fetching destination data for ${destination}...`);
  const destinationData = await fetchDestinationData(destination);

  // Step 2: Generate personalized recommendations
  console.log('Generating personalized recommendations...');
  const recommendations = await generateRecommendations(
    preferences,
    destinationData,
    tripDuration
  );

  // Step 3: Build day-by-day itinerary
  console.log('Building itinerary...');
  return await buildItinerary(recommendations, tripDuration, preferences, startDate);
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
      const rec = dayPlan.activities[i];
      const item = rec.item;

      const activityData = {
        day_id: day.id,
        title: 'name' in item ? item.name : '',
        description: 'description' in item ? item.description : '',
        location_name: 'address' in item ? item.address : '',
        category: rec.type === 'restaurant' ? 'dining' : 
                  'category' in item ? item.category : 'activity',
        estimated_cost: null,
        sort_order: i + 1,
        notes: rec.matchReasons.join('. '),
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
        .map((act: { id: string; title: string; description: string; category: string; sort_order: number; notes: string; location_name?: string; estimated_cost?: number }) => ({
          id: act.id,
          title: act.title,
          description: act.description,
          locationName: act.location_name,
          category: act.category,
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

  return data.map((it) => ({
    id: it.id,
    userId: it.user_id,
    title: it.title,
    destination: it.destination,
    startDate: new Date(it.start_date),
    endDate: new Date(it.end_date),
    days: [],
    status: it.status,
    createdAt: new Date(it.created_at),
  }));
}


/**
 * Regenerate an itinerary with variation
 * Creates a new version with different activities while respecting preferences
 */
export async function regenerateItinerary(
  supabase: SupabaseClient,
  itineraryId: string,
  options?: {
    excludeActivities?: string[]; // Activity names to avoid
    focusAreas?: string[]; // Areas to emphasize (e.g., 'food', 'culture')
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
    cuisinePreferences: prefsData.cuisine_preferences || [],
    activityTypes: prefsData.activity_types || [],
    budgetRange: prefsData.budget_range || 'moderate',
    travelPace: prefsData.travel_pace || 'moderate',
    accommodationType: prefsData.accommodation_type || 'hotel',
    transportPreferences: prefsData.transport_preferences || [],
    dietaryRestrictions: prefsData.dietary_restrictions || [],
    accessibilityNeeds: prefsData.accessibility_needs || [],
    adventureTolerance: prefsData.adventure_tolerance || 5,
    socialPreference: prefsData.social_preference || 'mixed',
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

  // Use AI Agent with variation prompt
  if (isAgentConfigured()) {
    console.log('Regenerating with AI Agent (with variation)...');
    
    // Build exclusion list from existing activities
    const existingActivityNames = existing.days.flatMap(d => 
      d.activities.map(a => a.item.name)
    );
    const excludeList = [
      ...(options?.excludeActivities || []),
      ...existingActivityNames,
    ];

    const agentResult = await runItineraryAgent({
      destination: existing.destination,
      startDate: existing.startDate,
      endDate: existing.endDate,
      preferences: modifiedPreferences,
    });

    if (agentResult.success && agentResult.itinerary) {
      dayPlans = agentResult.itinerary.days.map((day, index) => ({
        dayNumber: day.dayNumber,
        date: new Date(existing.startDate.getTime() + index * 24 * 60 * 60 * 1000),
        activities: day.activities
          .filter(act => !excludeList.some(ex => 
            act.name.toLowerCase().includes(ex.toLowerCase())
          ))
          .map((act) => ({
            type: act.type as 'attraction' | 'restaurant' | 'activity',
            item: { name: act.name, description: '', category: act.type },
            matchScore: 80,
            matchReasons: ['AI regenerated with variation'],
            suggestedTimeSlot: act.timeSlot as 'morning' | 'afternoon' | 'evening',
            suggestedDuration: act.duration,
          })),
        totalDuration: day.activities.reduce((sum, a) => sum + a.duration, 0),
        notes: day.notes,
      }));
    } else {
      dayPlans = await generateLocalItinerary(
        existing.destination, 
        tripDuration, 
        modifiedPreferences, 
        existing.startDate
      );
    }
  } else {
    dayPlans = await generateLocalItinerary(
      existing.destination, 
      tripDuration, 
      modifiedPreferences, 
      existing.startDate
    );
  }

  // Archive old itinerary
  await supabase
    .from('itineraries')
    .update({ status: 'archived' })
    .eq('id', itineraryId);

  // Save new version
  return await saveItineraryToDatabase(supabase, {
    userId: existing.userId,
    title: `${existing.title} (Regenerated)`,
    destination: existing.destination,
    startDate: existing.startDate,
    endDate: existing.endDate,
    dayPlans,
    preferences: modifiedPreferences,
  });
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
