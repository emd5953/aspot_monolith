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
import { UserPreferences, defaultPreferencesFor } from '@/types/profile';
import { ResearchResult, ActivityData, PlanItem } from './agents/types';
import { runPipeline } from './agents/pipeline';
import { discoverCandidates } from './agents/research';
import { calendarDateOf, nycNightWindow } from '@/lib/time/nyc';
import { getTonightPool } from '@/lib/sources/pool-service';
import { poolRowsToActivities } from './pool-events';
import type { Attraction, Restaurant, ActivityOption } from '@/types/destination';
import { type ItemSource, dedupeKey } from './provenance';
import { coordsColumns } from '@/lib/itinerary/itinerary-service';
import { estimateActivityCost } from './estimate-cost';

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
  /**
   * Provenance for this pick. Set explicitly on the agentic path (where the
   * `item` is a name-only stub); on the local path it's left undefined and
   * derived from the candidate's own signals at persistence time.
   */
  source?: ItemSource;
  /** Assigned schedule times ("HH:MM"), computed per day by assignDayTimes. */
  startTime?: string;
  endTime?: string;
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

export interface ItineraryInput {
  userId: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  title?: string;
  activityDensity?: 'relaxed' | 'moderate' | 'packed';
  /**
   * Free-text user focus extracted from the original prompt
   * (e.g. "R&B-leaning bars and live-music nightlife"). Threaded through to
   * the orchestrator/research/planner/reviewer so the trip is built around
   * what the user actually asked for, not just their quiz preferences.
   */
  userIntent?: string;
  /** Original prompt text, preserved verbatim for downstream prompts. */
  rawPrompt?: string;
}

export interface GeneratedItinerary {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  /** @deprecated Day-shaped output from the retiring planner. */
  days: DayPlan[];
  /** The Move-list: one flat run of plans, ordered by real start time. */
  plans?: PlanItem[];
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: Date;
  /** "Good to know" content from the planner. Empty on the local fallback path. */
  importantNotes?: string[];
  /** Traveler budget tier (from the preferences snapshot) — drives budget-fit. */
  budgetRange?: string;
}

export interface ProgressCallback {
  (data: { status: string; message: string; progress?: number }): void;
}

// ---------------------------------------------------------------------------
// Stored shapes: what `getItinerary` actually returns after reading the DB.
// (The flat activity row — NOT the in-memory ActivityRecommendation that the
// generator/persistence layer uses. Keeping them distinct is what lets call
// sites read activities without casts.)
// ---------------------------------------------------------------------------

export interface StoredActivity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  category: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
  source?: ItemSource;
  locationCoords?: { lat: number; lng: number };
}

export interface StoredDay {
  id: string;
  dayNumber: number;
  date: Date;
  notes: string;
  activities: StoredActivity[];
}

export interface StoredItinerary {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  /**
   * The Move-list: one flat run of stops in `sort_order`.
   *
   * This is what every caller should read. The DB still nests plans under a
   * single `itinerary_days` row to satisfy `plans.day_id NOT NULL`, and that
   * nesting is flattened here so nothing above persistence knows days exist.
   */
  plans: StoredActivity[];
  /** @deprecated The raw day nesting. Read `plans`. */
  days: StoredDay[];
  status: GeneratedItinerary['status'];
  createdAt: Date;
  importantNotes?: string[];
  budgetRange?: string;
}

/**
 * Generate tonight's Move-list.
 *
 * One pass: discover real candidates → select and rank them → order by the
 * time each event actually starts → persist. There is no scheduling step,
 * because Spotz does not decide when anything happens; the source already did.
 *
 * `deep` widens the research scrape and is delivered by email; it is the same
 * pipeline with a bigger pool, not a different one.
 */
export async function generateItinerary(
  supabase: SupabaseClient,
  input: ItineraryInput,
  preferences: UserPreferences,
  deep: boolean = false,
  onProgress?: ProgressCallback
): Promise<GeneratedItinerary> {
  const { userId, destination, startDate, endDate, title, userIntent, rawPrompt } = input;

  // The Moves: live events for tonight's window, from the candidate pool.
  // Non-fatal — generation still works from web research alone.
  let poolEvents: ActivityData[] = [];
  try {
    // NYC-anchored. `setHours` would resolve in the server's zone, which on
    // Vercel (UTC) started the window the previous evening.
    const { from: windowStart, to: windowEnd } = nycNightWindow(
      calendarDateOf(startDate),
      calendarDateOf(endDate)
    );
    const poolRows = await getTonightPool(supabase, { from: windowStart, to: windowEnd });
    poolEvents = poolRowsToActivities(poolRows);
    if (poolEvents.length > 0) {
      console.log(`[pool] ${poolEvents.length} live events joined the research pool`);
    }
  } catch (err) {
    console.warn('[pool] candidate pool unavailable, continuing without live events:', err);
  }

  onProgress?.({ status: 'researching', message: 'Finding whats on tonight...', progress: 20 });

  const { research } = await discoverCandidates({
    destination,
    preferences,
    userIntent,
    rawPrompt,
    startDate,
    endDate,
    poolEvents,
    useAdvancedMode: deep,
  });

  onProgress?.({ status: 'planning', message: 'Picking the moves...', progress: 60 });

  const result = await runPipeline({
    research,
    preferences,
    userIntent,
    rawPrompt,
    poolLimit: deep ? 40 : 24,
  });

  if (!result.success || !result.plan?.plans?.length) {
    throw new Error(result.error ?? 'Could not put a plan together for tonight');
  }

  if (result.check && result.check.findings.length > 0) {
    console.warn('[plan-check]\n' + result.check.summary);
  }

  onProgress?.({ status: 'saving', message: 'Saving your moves...', progress: 95 });

  return await savePlansToDatabase(supabase, {
    userId,
    title: title || `Tonight in ${destination}`,
    destination,
    startDate,
    endDate,
    plans: result.plan.plans,
    research: result.research,
    preferences,
    importantNotes: result.plan.importantNotes,
  });
}

/**
 * Insert one activity row, resilient to the `source` column (migration 013)
 * not yet being applied.
 *
 * `source` is provenance — nice to have, never load-bearing. But if the column
 * is missing, a plain insert that includes it fails the WHOLE row, and the
 * caller only logs the error, so the itinerary would silently save with zero
 * activities. So: on any insert error where we sent a `source`, retry once
 * without it. The activity still persists; the badge just won't show until the
 * migration runs. Returns true if the row landed.
 */
export async function insertActivityRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase.from('plans').insert(row);
  if (!error) return true;

  if ('source' in row) {
    const withoutSource = { ...row };
    delete withoutSource.source;
    const retry = await supabase.from('plans').insert(withoutSource);
    if (!retry.error) {
      console.warn(
        '[itinerary] activities.source missing — saved activity without provenance (apply migration 013)'
      );
      return true;
    }
    console.error('Failed to create activity:', retry.error);
    return false;
  }

  console.error('Failed to create activity:', error);
  return false;
}

/**
 * Save itinerary and activities to database
 */
/**
 * Persist a flat Move-list.
 *
 * Spotz is one night: one itinerary, one ordered run of plans. The DB still
 * has an `itinerary_days` table with `plans.day_id NOT NULL` FK-cascading off
 * it, so this writes exactly ONE day row and hangs every plan off it. That row
 * is an implementation detail — nothing above persistence knows it exists and
 * no UI renders it. Flattening it away is a later migration, made low-risk
 * precisely because nothing references days by then.
 *
 * `sort_order` is the rendered order, seeded from the pipeline's start-time
 * ordering. The user can drag plans afterwards and their order wins.
 */
async function savePlansToDatabase(
  supabase: SupabaseClient,
  data: {
    userId: string;
    title: string;
    destination: string;
    startDate: Date;
    endDate: Date;
    plans: PlanItem[];
    research: ResearchResult;
    preferences: UserPreferences;
    importantNotes?: string[];
  }
): Promise<GeneratedItinerary> {
  const { userId, title, destination, startDate, endDate, plans, research, preferences } = data;
  const importantNotes = data.importantNotes ?? [];

  // One active itinerary per user: archive whatever was live before this lands.
  const { error: archiveError } = await supabase
    .from('itineraries')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .in('status', ['draft', 'active']);
  if (archiveError) {
    console.warn('[itinerary] failed to archive previous itineraries:', archiveError.message);
  }

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

  // Best-effort: the column (migration 014) may not be applied, and that must
  // never fail the itinerary insert itself.
  if (importantNotes.length > 0) {
    const { error: notesError } = await supabase
      .from('itineraries')
      .update({ important_notes: importantNotes })
      .eq('id', itinerary.id);
    if (notesError) {
      console.warn(
        '[itinerary] important_notes not persisted (apply migration 014):',
        notesError.message
      );
    }
  }

  const { data: day, error: dayError } = await supabase
    .from('itinerary_days')
    .insert({
      itinerary_id: itinerary.id,
      day_number: 1,
      date: startDate.toISOString().split('T')[0],
      notes: '',
    })
    .select()
    .single();

  if (dayError) {
    throw new Error(`Failed to create day: ${dayError.message}`);
  }

  // Look venue detail back up from the pool the pick came from: a PlanItem
  // carries a name, not an address or coordinates.
  const byName = new Map<string, PoolLookup>();
  for (const item of [
    ...(research.attractions ?? []),
    ...(research.restaurants ?? []),
    ...(research.activities ?? []),
  ]) {
    const key = dedupeKey(item.name);
    if (key && !byName.has(key)) byName.set(key, item as PoolLookup);
  }

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const pooled = byName.get(dedupeKey(plan.name));

    await insertActivityRow(supabase, {
      day_id: day.id,
      title: plan.name,
      description: plan.description ?? '',
      location_name: pooled?.address?.trim() || plan.name,
      category: plan.type,
      // The real published time, or NULL. Never a made-up slot.
      start_time: toClockTime(plan.startsAt),
      end_time: toClockTime(plan.endsAt),
      duration: null,
      estimated_cost: estimateActivityCost(plan.type, pooled?.priceRange) || null,
      sort_order: i + 1,
      notes: plan.matchReasons?.join(', ') || '',
      source: plan.source ?? null,
      ...coordsColumns(pooled?.coordinates),
    });
  }

  return {
    id: itinerary.id,
    userId: itinerary.user_id,
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: new Date(itinerary.start_date),
    endDate: new Date(itinerary.end_date),
    days: [],
    plans,
    status: itinerary.status,
    createdAt: new Date(itinerary.created_at),
    importantNotes,
  };
}

/** Fields we read off a pool candidate when persisting a pick. */
interface PoolLookup {
  address?: string;
  priceRange?: string;
  coordinates?: { lat: number; lng: number };
}

/**
 * ISO instant → "HH:MM" in New York, for the `TIME` column. Null when the
 * source published no time — the column is nullable and unknown must stay
 * unknown rather than becoming midnight.
 */
function toClockTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Get an existing itinerary with all its days and activities
 */
export async function getItinerary(
  supabase: SupabaseClient,
  itineraryId: string
): Promise<StoredItinerary | null> {
  const { data: itinerary, error } = await supabase
    .from('itineraries')
    .select(`
      *,
      itinerary_days (
        *,
        activities:plans (*)
      )
    `)
    .eq('id', itineraryId)
    .single();

  if (error || !itinerary) {
    return null;
  }

  const days: StoredDay[] = itinerary.itinerary_days
    .sort((a: { day_number: number }, b: { day_number: number }) => a.day_number - b.day_number)
    .map((day: { id: string; day_number: number; date: string; activities: Array<{ id: string; title: string; description: string; category: string; sort_order: number; notes: string; location_name?: string; estimated_cost?: number; start_time?: string; end_time?: string; duration?: number; source?: ItemSource; location_lat?: number | string | null; location_lng?: number | string | null }>; notes: string }): StoredDay => ({
      id: day.id,
      dayNumber: day.day_number,
      date: new Date(day.date),
      notes: day.notes || '',
      activities: day.activities
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((act: { id: string; title: string; description: string; category: string; start_time?: string; end_time?: string; duration?: number; sort_order: number; notes: string; location_name?: string; estimated_cost?: number; source?: ItemSource; location_lat?: number | string | null; location_lng?: number | string | null }): StoredActivity => ({
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
          source: act.source,
          locationCoords:
            act.location_lat != null && act.location_lng != null
              ? { lat: Number(act.location_lat), lng: Number(act.location_lng) }
              : undefined,
        })),
    }));

  // Flatten to the one list callers actually want. Days are in day_number
  // order and each day's plans in sort_order, so concatenating preserves the
  // rendered order — including any the user set by hand.
  const plans = days.flatMap((day) => day.activities);

  return {
    id: itinerary.id,
    userId: itinerary.user_id,
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: new Date(itinerary.start_date),
    endDate: new Date(itinerary.end_date),
    plans,
    days,
    status: itinerary.status,
    createdAt: new Date(itinerary.created_at),
    importantNotes: itinerary.important_notes ?? [],
    budgetRange: itinerary.preferences_snapshot?.budgetRange,
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
 * Regenerate tonight's Move-list: same night, fresh picks.
 *
 * Replaces the plans in place rather than creating a new itinerary, so the
 * share link and its votes survive. Any manual reordering does not — a
 * regenerate is a new set of plans, not a reshuffle of the old one.
 */
export async function regenerateItinerary(
  supabase: SupabaseClient,
  itineraryId: string,
  options?: {
    /** Plan names to avoid this time round. */
    excludeActivities?: string[];
    /** Vibe to lean into, e.g. 'food', 'dancing'. */
    focusAreas?: string[];
  }
): Promise<GeneratedItinerary> {
  const existing = await getItinerary(supabase, itineraryId);
  if (!existing) {
    throw new Error('Itinerary not found');
  }

  // No per-user quiz profile: start neutral and let the focus options steer.
  const preferences: UserPreferences = defaultPreferencesFor(existing.userId);
  if (options?.focusAreas?.length) {
    preferences.activityTypes = [
      ...options.focusAreas,
      ...preferences.activityTypes.filter((t) => !options.focusAreas!.includes(t)),
    ];
  }

  let poolEvents: ActivityData[] = [];
  try {
    const { from: windowStart, to: windowEnd } = nycNightWindow(
      calendarDateOf(existing.startDate),
      calendarDateOf(existing.endDate)
    );
    const poolRows = await getTonightPool(supabase, { from: windowStart, to: windowEnd });
    poolEvents = poolRowsToActivities(poolRows);
  } catch (err) {
    console.warn('[pool] candidate pool unavailable on regenerate:', err);
  }

  const { research } = await discoverCandidates({
    destination: existing.destination,
    preferences,
    startDate: existing.startDate,
    endDate: existing.endDate,
    poolEvents,
  });

  // Honour the exclusions by removing them from the pool outright, so the
  // model cannot pick them back: an instruction not to would be advisory.
  const excluded = new Set((options?.excludeActivities ?? []).map(dedupeKey).filter(Boolean));
  const withoutExcluded: ResearchResult = excluded.size
    ? {
        ...research,
        attractions: (research.attractions ?? []).filter((a) => !excluded.has(dedupeKey(a.name))),
        restaurants: (research.restaurants ?? []).filter((r) => !excluded.has(dedupeKey(r.name))),
        activities: (research.activities ?? []).filter((a) => !excluded.has(dedupeKey(a.name))),
      }
    : research;

  const result = await runPipeline({
    research: withoutExcluded,
    preferences,
    poolLimit: 24,
  });

  if (!result.success || !result.plan?.plans?.length) {
    throw new Error(result.error ?? 'Could not put a new plan together');
  }

  // Swap the plans out under the existing itinerary. The day row is reused, so
  // the itinerary keeps its id, share code and votes.
  const { data: days } = await supabase
    .from('itinerary_days')
    .select('id')
    .eq('itinerary_id', itineraryId);

  const dayIds = (days ?? []).map((d: { id: string }) => d.id);
  if (dayIds.length > 0) {
    await supabase.from('plans').delete().in('day_id', dayIds);
  }

  let dayId = dayIds[0];
  if (!dayId) {
    const { data: day, error: dayError } = await supabase
      .from('itinerary_days')
      .insert({
        itinerary_id: itineraryId,
        day_number: 1,
        date: existing.startDate.toISOString().split('T')[0],
        notes: '',
      })
      .select()
      .single();
    if (dayError) throw new Error(`Failed to create day: ${dayError.message}`);
    dayId = day.id;
  }

  const byName = new Map<string, PoolLookup>();
  for (const item of [
    ...(result.research.attractions ?? []),
    ...(result.research.restaurants ?? []),
    ...(result.research.activities ?? []),
  ]) {
    const key = dedupeKey(item.name);
    if (key && !byName.has(key)) byName.set(key, item as PoolLookup);
  }

  const plans = result.plan.plans;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const pooled = byName.get(dedupeKey(plan.name));
    await insertActivityRow(supabase, {
      day_id: dayId,
      title: plan.name,
      description: plan.description ?? '',
      location_name: pooled?.address?.trim() || plan.name,
      category: plan.type,
      start_time: toClockTime(plan.startsAt),
      end_time: toClockTime(plan.endsAt),
      duration: null,
      estimated_cost: estimateActivityCost(plan.type, pooled?.priceRange) || null,
      sort_order: i + 1,
      notes: plan.matchReasons?.join(', ') || '',
      source: plan.source ?? null,
      ...coordsColumns(pooled?.coordinates),
    });
  }

  return {
    id: existing.id,
    userId: existing.userId,
    title: existing.title,
    destination: existing.destination,
    startDate: existing.startDate,
    endDate: existing.endDate,
    days: [],
    plans,
    status: existing.status,
    createdAt: existing.createdAt,
    importantNotes: result.plan.importantNotes,
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
      await supabase.from('plans').delete().eq('day_id', day.id);
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
