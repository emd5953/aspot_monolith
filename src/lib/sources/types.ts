import { z } from 'zod';

/**
 * The contract every source connector fulfills. Connectors fetch RAW
 * candidates from one platform (Posh, Luma, Partiful, TikTok, ...) and
 * normalize them into `RawCandidate`. They never write to the DB —
 * `pool-service` owns persistence, dedupe, and expiry.
 *
 * Provenance rule: every candidate carries source + sourceId + sourceUrl +
 * the untouched raw payload. Spotz never invents events.
 */

export const SOURCE_NAMES = ['posh', 'luma', 'partiful', 'tiktok', 'places', 'manual'] as const;
export type SourceName = (typeof SOURCE_NAMES)[number];

/** Only facts actually published by a source. Missing fields remain unknown. */
export const EventDetailsSchema = z.object({
  status: z.enum(['unknown', 'scheduled', 'cancelled', 'postponed']).default('unknown'),
  availability: z
    .enum([
      'unknown',
      'available',
      'sold_out',
      'waitlist',
      'registration_closed',
      'approval_required',
    ])
    .default('unknown'),
  locationVisibility: z.enum(['unknown', 'public', 'approximate', 'hidden']).default('unknown'),
  venueId: z.string().optional(),
  neighborhood: z.string().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  priceNotes: z.string().optional(),
  categories: z.array(z.string()).default([]),
  music: z
    .array(
      z.object({
        genre: z.string(),
        evidence: z.string(),
        field: z.enum(['title', 'description', 'tags']),
      })
    )
    .default([]),
  issues: z.array(z.string()).default([]),
});
export type EventDetails = z.infer<typeof EventDetailsSchema>;

export const RawCandidateSchema = z.object({
  source: z.enum(SOURCE_NAMES),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  venueName: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  isFree: z.boolean().optional(),
  details: EventDetailsSchema.optional(),
  /** Source-specific traction signals (guest_count, ticket_count, ...). */
  hype: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  /** Untouched source payload — provenance. */
  raw: z.unknown(),
});

export type RawCandidate = z.infer<typeof RawCandidateSchema>;

export interface SourceFetchOptions {
  /** Report partial coverage without discarding successfully fetched listings. */
  onWarning?: (message: string) => void;
}

export interface EventSource {
  name: SourceName;
  /** Env-flag gate; disabled sources are skipped by ingestion. */
  enabled(): boolean;
  /** Fetch current NYC candidates. Implementations must be polite: sequential requests with delays. */
  fetchCandidates(options?: SourceFetchOptions): Promise<RawCandidate[]>;
}

/** NYC bounding box (generous: five boroughs + close NJ/Westchester cut off). */
export const NYC_BOUNDS = {
  latMin: 40.49,
  latMax: 40.92,
  lngMin: -74.27,
  lngMax: -73.68,
};

export function isInNyc(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined) return true; // unlocated stays in pool (events rule)
  return (
    lat >= NYC_BOUNDS.latMin &&
    lat <= NYC_BOUNDS.latMax &&
    lng >= NYC_BOUNDS.lngMin &&
    lng <= NYC_BOUNDS.lngMax
  );
}
