/**
 * Itinerary CRUD Service
 * 
 * Handles all itinerary and activity management operations:
 * - Activity add, remove, update
 * - Activity reordering with conflict detection
 * - Day management
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface Activity {
  id: string;
  dayId: string;
  title: string;
  description: string;
  locationName?: string;
  locationCoords?: { lat: number; lng: number };
  startTime?: string;
  endTime?: string;
  category: string;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItineraryDay {
  id: string;
  itineraryId: string;
  dayNumber: number;
  date: Date;
  notes?: string;
  activities: Activity[];
}

export interface ActivityInput {
  title: string;
  description?: string;
  locationName?: string;
  locationCoords?: { lat: number; lng: number };
  startTime?: string;
  endTime?: string;
  category?: string;
  estimatedCost?: number;
  notes?: string;
}

/**
 * Add a new activity to a day
 */
export async function addActivity(
  supabase: SupabaseClient,
  dayId: string,
  activity: ActivityInput
): Promise<Activity> {
  // Get current max sort order for this day
  const { data: existingActivities } = await supabase
    .from('activities')
    .select('sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existingActivities?.[0]?.sort_order 
    ? existingActivities[0].sort_order + 1 
    : 1;

  const { data, error } = await supabase
    .from('activities')
    .insert({
      day_id: dayId,
      title: activity.title,
      description: activity.description || '',
      location_name: activity.locationName,
      location_coords: activity.locationCoords,
      start_time: activity.startTime,
      end_time: activity.endTime,
      category: activity.category || 'activity',
      estimated_cost: activity.estimatedCost,
      sort_order: nextSortOrder,
      notes: activity.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add activity: ${error.message}`);
  }

  return mapActivityFromDb(data);
}


/**
 * Update an existing activity
 */
export async function updateActivity(
  supabase: SupabaseClient,
  activityId: string,
  updates: Partial<ActivityInput>
): Promise<Activity> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.locationName !== undefined) updateData.location_name = updates.locationName;
  if (updates.locationCoords !== undefined) updateData.location_coords = updates.locationCoords;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.estimatedCost !== undefined) updateData.estimated_cost = updates.estimatedCost;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', activityId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update activity: ${error.message}`);
  }

  return mapActivityFromDb(data);
}

/**
 * Remove an activity
 */
export async function removeActivity(
  supabase: SupabaseClient,
  activityId: string
): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId);

  if (error) {
    throw new Error(`Failed to remove activity: ${error.message}`);
  }
}

/**
 * Reorder activities within a day
 * Returns conflict info if time slots overlap
 */
export async function reorderActivities(
  supabase: SupabaseClient,
  dayId: string,
  activityIds: string[]
): Promise<{ success: boolean; conflicts?: TimeConflict[] }> {
  // Update sort orders
  const updates = activityIds.map((id, index) => ({
    id,
    sort_order: index + 1,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('activities')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);

    if (error) {
      throw new Error(`Failed to reorder activities: ${error.message}`);
    }
  }

  // Check for time conflicts after reordering
  const conflicts = await detectTimeConflicts(supabase, dayId);

  return {
    success: true,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

export interface TimeConflict {
  activity1Id: string;
  activity1Title: string;
  activity2Id: string;
  activity2Title: string;
  overlapMinutes: number;
}

/**
 * Detect time conflicts between activities in a day
 */
export async function detectTimeConflicts(
  supabase: SupabaseClient,
  dayId: string
): Promise<TimeConflict[]> {
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: true });

  if (error || !activities) {
    return [];
  }

  const conflicts: TimeConflict[] = [];

  // Check each pair of activities for time overlap
  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a1 = activities[i];
      const a2 = activities[j];

      // Skip if either activity doesn't have times
      if (!a1.start_time || !a1.end_time || !a2.start_time || !a2.end_time) {
        continue;
      }

      const overlap = calculateOverlap(
        a1.start_time, a1.end_time,
        a2.start_time, a2.end_time
      );

      if (overlap > 0) {
        conflicts.push({
          activity1Id: a1.id,
          activity1Title: a1.title,
          activity2Id: a2.id,
          activity2Title: a2.title,
          overlapMinutes: overlap,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Calculate overlap in minutes between two time ranges
 */
function calculateOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): number {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Move an activity to a different day
 */
export async function moveActivityToDay(
  supabase: SupabaseClient,
  activityId: string,
  targetDayId: string
): Promise<Activity> {
  // Get max sort order in target day
  const { data: existingActivities } = await supabase
    .from('activities')
    .select('sort_order')
    .eq('day_id', targetDayId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existingActivities?.[0]?.sort_order 
    ? existingActivities[0].sort_order + 1 
    : 1;

  const { data, error } = await supabase
    .from('activities')
    .update({
      day_id: targetDayId,
      sort_order: nextSortOrder,
    })
    .eq('id', activityId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to move activity: ${error.message}`);
  }

  return mapActivityFromDb(data);
}

/**
 * Get all activities for a day
 */
export async function getDayActivities(
  supabase: SupabaseClient,
  dayId: string
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to get activities: ${error.message}`);
  }

  return data.map(mapActivityFromDb);
}

/**
 * Get all days for an itinerary with activities
 */
export async function getItineraryDays(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<ItineraryDay[]> {
  const { data, error } = await supabase
    .from('itinerary_days')
    .select(`
      *,
      activities (*)
    `)
    .eq('itinerary_id', itineraryId)
    .order('day_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to get itinerary days: ${error.message}`);
  }

  return data.map((day) => ({
    id: day.id,
    itineraryId: day.itinerary_id,
    dayNumber: day.day_number,
    date: new Date(day.date),
    notes: day.notes,
    activities: day.activities
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map(mapActivityFromDb),
  }));
}

/**
 * Update day notes
 */
export async function updateDayNotes(
  supabase: SupabaseClient,
  dayId: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from('itinerary_days')
    .update({ notes })
    .eq('id', dayId);

  if (error) {
    throw new Error(`Failed to update day notes: ${error.message}`);
  }
}

/**
 * Map database activity to Activity type
 */
function mapActivityFromDb(data: Record<string, unknown>): Activity {
  return {
    id: data.id as string,
    dayId: data.day_id as string,
    title: data.title as string,
    description: data.description as string,
    locationName: data.location_name as string | undefined,
    locationCoords: data.location_coords as { lat: number; lng: number } | undefined,
    startTime: data.start_time as string | undefined,
    endTime: data.end_time as string | undefined,
    category: data.category as string,
    estimatedCost: data.estimated_cost as number | undefined,
    sortOrder: data.sort_order as number,
    notes: data.notes as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
