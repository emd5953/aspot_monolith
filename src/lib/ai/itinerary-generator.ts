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
import { generateRecommendations, buildItinerary, DayPlan, ActivityRecommendation } from './sim-service';
import { runOrchestrator, OrchestratorOutput } from './agents/orchestrator';
import { runAgenticOrchestrator, AgenticOrchestratorOutput } from './agents/agentic-orchestrator';
import { ItineraryPlan, ScheduledItem } from './agents/types';
import { scheduleActivities, SchedulingOptions } from './smart-scheduler';

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

/**
 * Ultra-fast single AI call to generate complete itinerary
 * Skips research and planning agents, does everything in one shot
 */
async function generateItineraryFast(
  destination: string,
  startDate: Date,
  endDate: Date,
  preferences: UserPreferences,
  activityDensity: 'relaxed' | 'moderate' | 'packed' = 'moderate'
): Promise<DayPlan[]> {
  const { generateText } = await import('ai');
  const { openai } = await import('@ai-sdk/openai');
  
  const tripDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const densityGuide = {
    relaxed: '2-3 activities (excluding meals)',
    moderate: '4-5 activities (excluding meals)',
    packed: '6-8 activities (excluding meals)',
  };

  const prompt = `Create a ${tripDuration}-day itinerary for ${destination}.

Traveler: ${preferences.activityTypes.slice(0, 3).join(', ')}, ${preferences.cuisinePreferences.slice(0, 2).join(', ')}, ${preferences.budgetRange} budget, ${preferences.travelPace} pace.

Activity Density: ${activityDensity} (${densityGuide[activityDensity]})

IMPORTANT: 
- Include specific location names/addresses for each activity so they can be shown on a map
- DO NOT include meal activities (breakfast/lunch/dinner) - they will be added automatically
- Focus on attractions, activities, entertainment, shopping, etc.

Return JSON with ${tripDuration} days, each with ${densityGuide[activityDensity]}:
{"days":[{"dayNumber":1,"activities":[{"name":"Eiffel Tower","description":"Iconic landmark","category":"attraction","locationName":"Champ de Mars, 5 Avenue Anatole France, 75007 Paris"}]}]}`;

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
    temperature: 0.8,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  return (parsed.days || []).map((day: { dayNumber: number; activities: Array<{ name: string; description: string; category: string; locationName?: string }> }, index: number) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + index);

    // Prepare activities for scheduling
    const rawActivities = (day.activities || []).map((act: { name: string; description: string; category: string; locationName?: string }, i: number) => ({
      id: `temp-${index}-${i}`,
      title: act.name || 'Activity',
      description: act.description || '',
      locationName: act.locationName || act.name,
      category: act.category || 'activity',
      sortOrder: i + 1,
      notes: '',
    }));

    // Apply smart scheduling with meals and time gaps
    const scheduledActivities = scheduleActivities(rawActivities, {
      activityDensity,
      mealPreferences: preferences.cuisinePreferences,
    });

    return {
      dayNumber: day.dayNumber || index + 1,
      date: dayDate,
      activities: scheduledActivities,
      notes: '',
    };
  });
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
  useTrulyAgentic: boolean = false // NEW: Use the truly agentic system
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

  // Choose mode based on user preference
  const useFastMode = !useAgenticMode && !useTrulyAgentic && (process.env.FAST_MODE === 'true' || !process.env.OPENAI_API_KEY);
  
  if (useFastMode) {
    console.log('[TIMING] Using ULTRA FAST single-call generation...');
    const startTime = Date.now();
    
    try {
      dayPlans = await generateItineraryFast(destination, startDate, endDate, preferences, activityDensity);
      console.log(`[TIMING] Single-call generation completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } catch (error) {
      console.error('Fast generation error:', error);
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate, activityDensity);
    }
  } else if (useTrulyAgentic) {
    // TRULY AGENTIC MODE: Full reasoning, adaptive stopping, dynamic tool selection
    console.log('[TIMING] Starting TRULY AGENTIC System...');
    console.log('Features: Dynamic tool selection, reasoning chains, adaptive stopping');
    const startTime = Date.now();
    
    try {
      const agenticResult = await runAgenticOrchestrator({
        destination,
        startDate,
        endDate,
        preferences,
        qualityThreshold: 80, // Stop when score reaches 80
        maxIterations: 5, // Safety limit
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
          if (state.reasoning && state.reasoning.length > 0) {
            const latest = state.reasoning[state.reasoning.length - 1];
            console.log(`  💭 ${latest.agent}: ${latest.thought}`);
          }
        },
      });

      console.log(`[TIMING] Truly Agentic System completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (agenticResult.success && agenticResult.plan) {
        dayPlans = convertAgentPlanToDayPlans(agenticResult.plan, startDate);
        
        console.log('🤖 Truly Agentic orchestration complete!');
        console.log(`Final score: ${agenticResult.finalScore}/100`);
        console.log(`Iterations: ${agenticResult.iterations}`);
        console.log(`Reasoning steps: ${agenticResult.reasoning.length}`);
        console.log('\nReasoning Chain:');
        agenticResult.reasoning.forEach((step, i) => {
          console.log(`${i + 1}. [${step.agent}] ${step.thought} → ${step.action} → ${step.result}`);
        });
      } else {
        console.warn('Truly Agentic system failed, falling back to local pipeline');
        dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
      }
    } catch (error) {
      console.error('Truly Agentic error:', error);
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
    }
  } else {
    // Standard Multi-Agent System (Agentic Mode)
    console.log('[TIMING] Starting Multi-Agent System (Agentic Mode)...');
    const startTime = Date.now();
    console.log('Agents: Research → Plan → Review (with autonomous loops)');
    
    try {
      orchestratorResult = await runOrchestrator({
        destination,
        startDate,
        endDate,
        preferences,
        useFastMode: false, // Agentic mode uses full features
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
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
        dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
      }
    } catch (error) {
      console.error('Multi-Agent error:', error);
      dayPlans = await generateLocalItinerary(destination, tripDuration, preferences, startDate);
    }
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
  const item = activity.item as any; // Type assertion to handle union type
  return {
    title: item.name || '',
    description: item.description || '',
    locationName: item.name || '',
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
 * Local fallback pipeline (Firecrawl + scoring)
 */
async function generateLocalItinerary(
  destination: string,
  tripDuration: number,
  preferences: UserPreferences,
  startDate: Date,
  activityDensity: 'relaxed' | 'moderate' | 'packed' = 'moderate'
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
    cuisinePreferences: prefsData.cuisine_preferences || [],
    activityTypes: prefsData.activity_types || [],
    budgetRange: prefsData.budget_range || 'moderate',
    travelPace: prefsData.travel_pace || 'moderate',
    accommodationStyle: prefsData.accommodation_style || 'hotel',
    socialPreferences: prefsData.social_preferences || 'solo',
    accessibilityNeeds: prefsData.accessibility_needs || [],
    climatePreferences: prefsData.climate_preferences || [],
    culturalInterests: prefsData.cultural_interests || [],
    adventureTolerance: prefsData.adventure_tolerance || 5,
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

  // Use agentic mode if requested, otherwise fast mode
  const useAgenticMode = options?.useAgenticMode || false;
  const useTrulyAgentic = options?.useTrulyAgentic || false;

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
        qualityThreshold: 80,
        maxIterations: 5,
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
        console.log('\n🧠 Reasoning Chain:');
        agenticResult.reasoning.forEach((step, i) => {
          console.log(`${i + 1}. [${step.agent}] ${step.thought}`);
          console.log(`   → ${step.action}`);
          console.log(`   → ${step.result}`);
        });
      } else {
        console.error('DEBUG: Agentic result failed or no plan:', agenticResult);
        console.warn('Truly Agentic regeneration failed, falling back to fast mode');
        dayPlans = await generateItineraryFast(
          existing.destination,
          existing.startDate,
          existing.endDate,
          modifiedPreferences
        );
      }
    } catch (error) {
      console.error('Truly Agentic regeneration error:', error);
      dayPlans = await generateItineraryFast(
        existing.destination,
        existing.startDate,
        existing.endDate,
        modifiedPreferences
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
        useFastMode: false,
        onProgress: (state) => {
          console.log(`[${state.status}] Iteration ${state.iteration}/${state.maxIterations}`);
        },
      });

      console.log(`[TIMING] Multi-Agent regeneration completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

      if (orchestratorResult.success && orchestratorResult.plan) {
        dayPlans = convertAgentPlanToDayPlans(orchestratorResult.plan, existing.startDate);
        console.log(`Regeneration score: ${orchestratorResult.state.review?.score || 'N/A'}/100`);
      } else {
        console.warn('Multi-Agent regeneration failed, falling back to fast mode');
        dayPlans = await generateItineraryFast(
          existing.destination,
          existing.startDate,
          existing.endDate,
          modifiedPreferences
        );
      }
    } catch (error) {
      console.error('Multi-Agent regeneration error:', error);
      dayPlans = await generateItineraryFast(
        existing.destination,
        existing.startDate,
        existing.endDate,
        modifiedPreferences
      );
    }
  } else {
    // Fast mode regeneration
    console.log('[TIMING] Regenerating with fast mode...');
    const startTime = Date.now();
    
    try {
      dayPlans = await generateItineraryFast(
        existing.destination,
        existing.startDate,
        existing.endDate,
        modifiedPreferences
      );
      console.log(`[TIMING] Regeneration completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } catch (error) {
      console.error('Regeneration error:', error);
      dayPlans = await generateLocalItinerary(
        existing.destination,
        tripDuration,
        modifiedPreferences,
        existing.startDate
      );
    }
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
