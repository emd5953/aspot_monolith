/**
 * Trip Service
 * 
 * Handles collaborative trip creation and management:
 * - Create trips with invite codes
 * - Link trips to itineraries
 * - Manage trip membership
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

export interface Trip {
  id: string;
  name: string;
  itineraryId: string;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: 'organizer' | 'editor' | 'viewer';
  joinedAt: Date;
  profile?: {
    displayName: string;
    avatarUrl?: string;
  };
}

export interface CreateTripInput {
  name: string;
  itineraryId: string;
}

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  return nanoid(10).toUpperCase();
}

/**
 * Create a new collaborative trip from an itinerary
 */
export async function createTrip(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTripInput
): Promise<Trip> {
  const { name, itineraryId } = input;

  // Verify user owns the itinerary
  const { data: itinerary, error: itError } = await supabase
    .from('itineraries')
    .select('id, user_id')
    .eq('id', itineraryId)
    .single();

  if (itError || !itinerary) {
    throw new Error('Itinerary not found');
  }

  if (itinerary.user_id !== userId) {
    throw new Error('You can only create trips from your own itineraries');
  }

  // Check if trip already exists for this itinerary
  const { data: existingTrip } = await supabase
    .from('trips')
    .select('id')
    .eq('itinerary_id', itineraryId)
    .single();

  if (existingTrip) {
    throw new Error('A trip already exists for this itinerary');
  }

  // Create trip with invite code
  const inviteCode = generateInviteCode();
  
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      name,
      itinerary_id: itineraryId,
      invite_code: inviteCode,
      created_by: userId,
    })
    .select()
    .single();

  if (tripError) {
    throw new Error(`Failed to create trip: ${tripError.message}`);
  }

  // Add creator as organizer
  const { error: memberError } = await supabase
    .from('trip_members')
    .insert({
      trip_id: trip.id,
      user_id: userId,
      role: 'organizer',
    });

  if (memberError) {
    // Rollback trip creation
    await supabase.from('trips').delete().eq('id', trip.id);
    throw new Error(`Failed to add organizer: ${memberError.message}`);
  }

  return mapTripFromDb(trip);
}


/**
 * Get a trip by ID with members
 */
export async function getTrip(
  supabase: SupabaseClient,
  tripId: string
): Promise<(Trip & { members: TripMember[] }) | null> {
  const { data: trip, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members (
        *,
        profiles:user_id (display_name, avatar_url)
      )
    `)
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return null;
  }

  return {
    ...mapTripFromDb(trip),
    members: trip.trip_members.map(mapMemberFromDb),
  };
}

/**
 * Get trip by invite code
 */
export async function getTripByInviteCode(
  supabase: SupabaseClient,
  inviteCode: string
): Promise<Trip | null> {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !trip) {
    return null;
  }

  return mapTripFromDb(trip);
}

/**
 * Join a trip via invite code
 */
export async function joinTrip(
  supabase: SupabaseClient,
  userId: string,
  inviteCode: string
): Promise<TripMember> {
  // Find trip by invite code
  const trip = await getTripByInviteCode(supabase, inviteCode);
  if (!trip) {
    throw new Error('Invalid invite code');
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    throw new Error('You are already a member of this trip');
  }

  // Add as viewer by default
  const { data: member, error } = await supabase
    .from('trip_members')
    .insert({
      trip_id: trip.id,
      user_id: userId,
      role: 'viewer',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to join trip: ${error.message}`);
  }

  return mapMemberFromDb(member);
}

/**
 * Update member role
 */
export async function updateMemberRole(
  supabase: SupabaseClient,
  tripId: string,
  memberId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .update({ role })
    .eq('id', memberId)
    .eq('trip_id', tripId);

  if (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }
}

/**
 * Remove a member from trip
 */
export async function removeMember(
  supabase: SupabaseClient,
  tripId: string,
  memberId: string
): Promise<void> {
  // Check if trying to remove organizer
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('id', memberId)
    .single();

  if (member?.role === 'organizer') {
    throw new Error('Cannot remove the trip organizer');
  }

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('id', memberId)
    .eq('trip_id', tripId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

/**
 * Leave a trip
 */
export async function leaveTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<void> {
  // Check if user is organizer
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (member?.role === 'organizer') {
    throw new Error('Organizer cannot leave the trip. Transfer ownership first or delete the trip.');
  }

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to leave trip: ${error.message}`);
  }
}

/**
 * List trips for a user
 */
export async function listUserTrips(
  supabase: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select(`
      trips (*)
    `)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to list trips: ${error.message}`);
  }

  return data
    .filter(d => d.trips)
    .map(d => mapTripFromDb(d.trips as unknown as Record<string, unknown>));
}

/**
 * Regenerate invite code
 */
export async function regenerateInviteCode(
  supabase: SupabaseClient,
  tripId: string
): Promise<string> {
  const newCode = generateInviteCode();

  const { error } = await supabase
    .from('trips')
    .update({ invite_code: newCode })
    .eq('id', tripId);

  if (error) {
    throw new Error(`Failed to regenerate invite code: ${error.message}`);
  }

  return newCode;
}

/**
 * Delete a trip
 */
export async function deleteTrip(
  supabase: SupabaseClient,
  tripId: string
): Promise<void> {
  // Members will be deleted via cascade
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    throw new Error(`Failed to delete trip: ${error.message}`);
  }
}

// Helper functions
function mapTripFromDb(data: Record<string, unknown>): Trip {
  return {
    id: data.id as string,
    name: data.name as string,
    itineraryId: data.itinerary_id as string,
    inviteCode: data.invite_code as string,
    createdBy: data.created_by as string,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapMemberFromDb(data: Record<string, unknown>): TripMember {
  const profiles = data.profiles as Record<string, unknown> | null;
  return {
    id: data.id as string,
    tripId: data.trip_id as string,
    userId: data.user_id as string,
    role: data.role as 'organizer' | 'editor' | 'viewer',
    joinedAt: new Date(data.joined_at as string || data.created_at as string),
    profile: profiles ? {
      displayName: profiles.display_name as string,
      avatarUrl: profiles.avatar_url as string | undefined,
    } : undefined,
  };
}
