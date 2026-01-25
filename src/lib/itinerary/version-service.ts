/**
 * Itinerary Version History Service
 * 
 * Handles version snapshots for itineraries:
 * - Create snapshots on changes
 * - List version history
 * - Revert to previous versions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getItineraryDays, ItineraryDay } from './itinerary-service';

export interface ItineraryVersion {
  id: string;
  itineraryId: string;
  versionNumber: number;
  snapshot: ItinerarySnapshot;
  changeDescription?: string;
  createdBy: string;
  createdAt: Date;
}

export interface ItinerarySnapshot {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Array<{
    dayNumber: number;
    date: string;
    notes?: string;
    activities: Array<{
      title: string;
      description: string;
      locationName?: string;
      startTime?: string;
      endTime?: string;
      category: string;
      estimatedCost?: number;
      sortOrder: number;
      notes?: string;
    }>;
  }>;
}

/**
 * Create a version snapshot of the current itinerary state
 */
export async function createVersionSnapshot(
  supabase: SupabaseClient,
  itineraryId: string,
  userId: string,
  changeDescription?: string
): Promise<ItineraryVersion> {
  // Get current itinerary data
  const { data: itinerary, error: itError } = await supabase
    .from('itineraries')
    .select('*')
    .eq('id', itineraryId)
    .single();

  if (itError || !itinerary) {
    throw new Error('Itinerary not found');
  }

  // Get all days with activities
  const days = await getItineraryDays(supabase, itineraryId);

  // Build snapshot
  const snapshot: ItinerarySnapshot = {
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: itinerary.start_date,
    endDate: itinerary.end_date,
    days: days.map(day => ({
      dayNumber: day.dayNumber,
      date: day.date.toISOString().split('T')[0],
      notes: day.notes,
      activities: day.activities.map(act => ({
        title: act.title,
        description: act.description,
        locationName: act.locationName,
        startTime: act.startTime,
        endTime: act.endTime,
        category: act.category,
        estimatedCost: act.estimatedCost,
        sortOrder: act.sortOrder,
        notes: act.notes,
      })),
    })),
  };

  // Get next version number
  const { data: versions } = await supabase
    .from('itinerary_versions')
    .select('version_number')
    .eq('itinerary_id', itineraryId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = versions?.[0]?.version_number 
    ? versions[0].version_number + 1 
    : 1;

  // Save version
  const { data, error } = await supabase
    .from('itinerary_versions')
    .insert({
      itinerary_id: itineraryId,
      version_number: nextVersion,
      snapshot,
      change_description: changeDescription,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create version: ${error.message}`);
  }

  return mapVersionFromDb(data);
}


/**
 * List all versions for an itinerary
 */
export async function listVersions(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<ItineraryVersion[]> {
  const { data, error } = await supabase
    .from('itinerary_versions')
    .select('*')
    .eq('itinerary_id', itineraryId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(`Failed to list versions: ${error.message}`);
  }

  return data.map(mapVersionFromDb);
}

/**
 * Get a specific version
 */
export async function getVersion(
  supabase: SupabaseClient,
  versionId: string
): Promise<ItineraryVersion | null> {
  const { data, error } = await supabase
    .from('itinerary_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapVersionFromDb(data);
}

/**
 * Revert itinerary to a previous version
 * Creates a new version snapshot before reverting
 */
export async function revertToVersion(
  supabase: SupabaseClient,
  itineraryId: string,
  versionId: string,
  userId: string
): Promise<void> {
  // Get the version to revert to
  const version = await getVersion(supabase, versionId);
  if (!version || version.itineraryId !== itineraryId) {
    throw new Error('Version not found');
  }

  // Create a snapshot of current state before reverting
  await createVersionSnapshot(
    supabase, 
    itineraryId, 
    userId, 
    `Auto-saved before reverting to version ${version.versionNumber}`
  );

  const snapshot = version.snapshot;

  // Update itinerary metadata
  await supabase
    .from('itineraries')
    .update({
      title: snapshot.title,
      destination: snapshot.destination,
      start_date: snapshot.startDate,
      end_date: snapshot.endDate,
    })
    .eq('id', itineraryId);

  // Get current days
  const { data: currentDays } = await supabase
    .from('itinerary_days')
    .select('id')
    .eq('itinerary_id', itineraryId);

  // Delete current activities and days
  if (currentDays) {
    for (const day of currentDays) {
      await supabase.from('activities').delete().eq('day_id', day.id);
    }
    await supabase.from('itinerary_days').delete().eq('itinerary_id', itineraryId);
  }

  // Recreate days and activities from snapshot
  for (const daySnapshot of snapshot.days) {
    const { data: newDay, error: dayError } = await supabase
      .from('itinerary_days')
      .insert({
        itinerary_id: itineraryId,
        day_number: daySnapshot.dayNumber,
        date: daySnapshot.date,
        notes: daySnapshot.notes,
      })
      .select()
      .single();

    if (dayError || !newDay) {
      throw new Error(`Failed to restore day: ${dayError?.message}`);
    }

    // Recreate activities
    for (const actSnapshot of daySnapshot.activities) {
      await supabase.from('activities').insert({
        day_id: newDay.id,
        title: actSnapshot.title,
        description: actSnapshot.description,
        location_name: actSnapshot.locationName,
        start_time: actSnapshot.startTime,
        end_time: actSnapshot.endTime,
        category: actSnapshot.category,
        estimated_cost: actSnapshot.estimatedCost,
        sort_order: actSnapshot.sortOrder,
        notes: actSnapshot.notes,
      });
    }
  }

  // Create a new version marking the revert
  await createVersionSnapshot(
    supabase,
    itineraryId,
    userId,
    `Reverted to version ${version.versionNumber}`
  );
}

/**
 * Compare two versions and return differences
 */
export async function compareVersions(
  supabase: SupabaseClient,
  versionId1: string,
  versionId2: string
): Promise<VersionDiff> {
  const v1 = await getVersion(supabase, versionId1);
  const v2 = await getVersion(supabase, versionId2);

  if (!v1 || !v2) {
    throw new Error('One or both versions not found');
  }

  const diff: VersionDiff = {
    metadataChanges: [],
    addedActivities: [],
    removedActivities: [],
    modifiedActivities: [],
  };

  // Compare metadata
  if (v1.snapshot.title !== v2.snapshot.title) {
    diff.metadataChanges.push({
      field: 'title',
      oldValue: v1.snapshot.title,
      newValue: v2.snapshot.title,
    });
  }

  // Build activity maps for comparison
  const v1Activities = new Map<string, { day: number; activity: typeof v1.snapshot.days[0]['activities'][0] }>();
  const v2Activities = new Map<string, { day: number; activity: typeof v2.snapshot.days[0]['activities'][0] }>();

  for (const day of v1.snapshot.days) {
    for (const act of day.activities) {
      v1Activities.set(`${day.dayNumber}-${act.title}`, { day: day.dayNumber, activity: act });
    }
  }

  for (const day of v2.snapshot.days) {
    for (const act of day.activities) {
      v2Activities.set(`${day.dayNumber}-${act.title}`, { day: day.dayNumber, activity: act });
    }
  }

  // Find added and removed
  for (const [key, { day, activity }] of v2Activities) {
    if (!v1Activities.has(key)) {
      diff.addedActivities.push({ dayNumber: day, title: activity.title });
    }
  }

  for (const [key, { day, activity }] of v1Activities) {
    if (!v2Activities.has(key)) {
      diff.removedActivities.push({ dayNumber: day, title: activity.title });
    }
  }

  return diff;
}

export interface VersionDiff {
  metadataChanges: Array<{ field: string; oldValue: string; newValue: string }>;
  addedActivities: Array<{ dayNumber: number; title: string }>;
  removedActivities: Array<{ dayNumber: number; title: string }>;
  modifiedActivities: Array<{ dayNumber: number; title: string; changes: string[] }>;
}

/**
 * Map database version to ItineraryVersion type
 */
function mapVersionFromDb(data: Record<string, unknown>): ItineraryVersion {
  return {
    id: data.id as string,
    itineraryId: data.itinerary_id as string,
    versionNumber: data.version_number as number,
    snapshot: data.snapshot as ItinerarySnapshot,
    changeDescription: data.change_description as string | undefined,
    createdBy: data.created_by as string,
    createdAt: new Date(data.created_at as string),
  };
}
