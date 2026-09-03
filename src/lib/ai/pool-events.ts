import type { PoolCandidateRow } from '@/lib/sources/pool-service';
import type { ActivityData } from './agents/types';

/**
 * Convert candidate_events pool rows (Posh/Luma/Partiful/TikTok) into the
 * ActivityData shape the planner already understands. These are the Moves —
 * real, time-anchored events with provenance — and they enter the research
 * pool alongside Tavily/Places results.
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
    duration: 120,
    adventureLevel: 5,
    priceRange: priceRange(row),
    bestTime: 'evening',
    coordinates:
      row.lat != null && row.lng != null ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined,
  };
}

export function poolRowsToActivities(rows: PoolCandidateRow[]): ActivityData[] {
  return rows.map(poolRowToActivity);
}
