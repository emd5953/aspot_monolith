import type { PoolCandidateRow } from '@/lib/sources/pool-service';
import type { ActivityData } from './agents/types';

/**
 * Convert candidate_events pool rows (Posh/Luma/Partiful/TikTok) into the
 * ActivityData shape the pipeline understands. These are the Moves — real,
 * time-anchored events with provenance — and they enter the research pool
 * alongside Tavily/Places results.
 *
 * The event's published `starts_at` is carried through as structured data
 * (`startsAt`), not just prose. It is what orders the plan list, and it is the
 * reason the pipeline never has to invent a clock time: for a pool event the
 * real one is already known.
 */

function fmtTime(iso: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

function priceRange(row: PoolCandidateRow): string {
  if (row.is_free) return 'free';
  if (row.price_min == null && row.price_max == null) return '$$';
  const hi = row.price_max ?? row.price_min ?? 0;
  if (hi <= 15) return '$';
  if (hi <= 50) return '$$';
  return '$$$';
}

/**
 * Duration in minutes, from the published window when the source gave one.
 * Falls back to 120 only when `ends_at` is missing — a display default, not a
 * claim about the event. Guards against a non-positive span (bad source data).
 */
function durationMinutes(row: PoolCandidateRow): number {
  if (!row.starts_at || !row.ends_at) return 120;
  const span =
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000;
  return Number.isFinite(span) && span > 0 ? Math.round(span) : 120;
}

export function poolRowToActivity(row: PoolCandidateRow): ActivityData {
  const when = fmtTime(row.starts_at);
  const descriptionBits = [
    row.description?.slice(0, 300),
    when ? `Starts ${when}` : undefined,
    row.venue_name ? `at ${row.venue_name}` : undefined,
  ].filter(Boolean);

  return {
    name: row.title,
    description: descriptionBits.join(' — ') || row.title,
    category: 'event',
    duration: durationMinutes(row),
    adventureLevel: 5,
    priceRange: priceRange(row),
    // Pool events are night-out events. Kept for the classic planner's prompt;
    // it retires with that planner, since `startsAt` says this properly.
    bestTime: 'evening',
    // The real published times. Absent stays absent — an event with no
    // announced start is unknown, not untimed.
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    coordinates:
      row.lat != null && row.lng != null ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined,
  };
}

export function poolRowsToActivities(rows: PoolCandidateRow[]): ActivityData[] {
  return rows.map(poolRowToActivity);
}
