/**
 * Itinerary Generator Service
 * 
 * This is the main orchestrator that:
 * 1. Fetches destination data via Firecrawl
 * 2. Gets personalized recommendations via SIM
 * 3. Builds a complete day-by-day itinerary
 * 4. Saves it to the database
 * 
 * The flow:
 * User Input (destination, dates) + User Preferences
 *     ↓
 * Firecrawl → Scrapes travel sites for destination info
 *     ↓
 * SIM → Scores & ranks activities based on preferences
 *     ↓
 * Itinerary Builder → Creates balanced daily schedules
 *     ↓
 * Database → Saves itinerary with all activities
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserPreferences } from '@/types/quiz';
import { fetchDestinationData } from './firecrawl-service';
import { generateRecommendations, buildItinerary, DayPlan } from './sim-service';

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

  // Step 1: Fetch destination data via Firecrawl
  console.log(`Fetching destination data for ${destination}...`);
  const destinationData = await fetchDestinationData(destination);

  // Step 2: Generate personalized recommendations via SIM
  console.log('Generating personalized recommendations...');
  const recommendations = await generateRecommendations(
    preferences,
    destinationData,
    tripDuration
  );

  // Step 3: Build day-by-day itinerary
  console.log('Building itinerary...');
  const dayPlans = await buildItinerary(
    recommendations,
    tripDuration,
    preferences,
    startDate
  );

  // Step 4: Save to database
  const itineraryTitle = title || `Trip to ${destination}`;

  // Create itinerary record
  const { data: itinerary, error: itineraryError } = await supabase
    .from('itineraries')
    .insert({
      user_id: userId,
      title: itineraryTitle,
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
    .map((day: { day_number: number; date: string; activities: Array<{ title: string; description: string; category: string; sort_order: number; notes: string }>; notes: string }) => ({
      dayNumber: day.day_number,
      date: new Date(day.date),
      activities: day.activities
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((act: { title: string; description: string; category: string; sort_order: number; notes: string }) => ({
          type: act.category === 'dining' ? 'restaurant' : 'activity',
          item: {
            name: act.title,
            description: act.description,
            category: act.category,
          },
          matchScore: 0,
          matchReasons: act.notes ? act.notes.split('. ') : [],
          suggestedTimeSlot: 'morning' as const,
          suggestedDuration: 60,
        })),
      totalDuration: day.activities.length * 60,
      notes: day.notes || '',
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
