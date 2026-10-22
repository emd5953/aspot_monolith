import { EventDetailsSchema, type EventDetails } from './types';
import { z } from 'zod';

const SourceTimestampSchema = z.string().datetime({ offset: true });

export function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function number(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Never let the host timezone interpret a source's ambiguous wall clock. */
export function sourceTime(value: unknown): string | undefined {
  const s = text(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) return undefined;
  const normalized = s.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  if (!SourceTimestampSchema.safeParse(normalized).success) return undefined;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Links are source evidence, never executable schemes or arbitrary hosts. */
export function sourceUrl(value: unknown, base: string, hosts: string[]): string | undefined {
  const s = text(value);
  if (!s) return undefined;
  try {
    const url = new URL(s, base);
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password)
      return undefined;
    url.hash = '';
    url.search = '';
    return url.href;
  } catch {
    return undefined;
  }
}

// These are literal, attributed mentions, not a judgement about a venue's
// musical identity. In particular, a venue named "House of Yes" is not house music.
export const MUSIC_PATTERNS: Record<string, RegExp> = {
  rnb: /\b(?:r\s*&\s*b|rnb|r['’]n['’]b|rhythm\s+(?:and|&)\s+blues)\b/i,
  hip_hop: /\bhip[ -]?hop\b/i,
  afrobeats: /\bafrobeats?\b/i,
  house: /\b(?:house music|house dj|deep house|afro house|tech house)\b/i,
  techno: /\btechno\b/i,
  jazz: /\bjazz\b/i,
  salsa: /\bsalsa\b/i,
};

export function eventDetails(
  input: {
    title: string;
    description?: string;
    tags?: string[];
    status?: unknown;
    cancelled?: unknown;
    postponed?: unknown;
    availability?: unknown;
    soldOut?: unknown;
    waitlist?: unknown;
    closed?: unknown;
    approval?: unknown;
    available?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
  } & Partial<
    Pick<
      EventDetails,
      'currency' | 'priceNotes' | 'venueId' | 'neighborhood' | 'locationVisibility'
    >
  >
): EventDetails {
  const status = text(input.status)?.toLowerCase();
  const availability = text(input.availability)?.toLowerCase().replace(/[ -]/g, '_');
  const fields = {
    title: input.title,
    description: input.description ?? '',
    tags: input.tags?.join(', ') ?? '',
  };
  const music: EventDetails['music'] = [];
  for (const [genre, pattern] of Object.entries(MUSIC_PATTERNS)) {
    for (const [field, value] of Object.entries(fields)) {
      const match = pattern.exec(value);
      if (match) {
        const prefix = value.slice(Math.max(0, match.index - 24), match.index);
        if (/\b(?:no|not|without)\s+(?:any\s+)?$/i.test(prefix)) continue;
        music.push({
          genre,
          evidence: value.slice(Math.max(0, match.index - 30), match.index + match[0].length + 50),
          field: field as 'title' | 'description' | 'tags',
        });
        break;
      }
    }
  }
  const content = Object.values(fields).join(' ');
  const categories = [
    /\b(party|nightclub|dance floor|dj set|rave|nightlife)\b/i.test(content) ? 'nightlife' : '',
    /\b(live music|concert|live jazz|live performance)\b/i.test(content) ? 'live_music' : '',
    /\b(social|mixer|meetup|hangout|community|singles)\b/i.test(content) ? 'social' : '',
  ].filter(Boolean);
  const issues: string[] = [];
  if (input.startsAt && !sourceTime(input.startsAt))
    issues.push('Start time has no usable timezone or is invalid.');
  if (input.endsAt && !sourceTime(input.endsAt))
    issues.push('End time has no usable timezone or is invalid.');
  if (
    sourceTime(input.startsAt) &&
    sourceTime(input.endsAt) &&
    sourceTime(input.endsAt)! <= sourceTime(input.startsAt)!
  )
    issues.push('Published end precedes start; end time omitted.');
  return EventDetailsSchema.parse({
    status:
      input.cancelled === true || ['cancelled', 'canceled'].includes(status ?? '')
        ? 'cancelled'
        : input.postponed === true || status === 'postponed'
          ? 'postponed'
          : ['published', 'scheduled', 'active'].includes(status ?? '')
            ? 'scheduled'
            : 'unknown',
    availability:
      input.soldOut === true || availability === 'sold_out'
        ? 'sold_out'
        : input.closed === true || ['closed', 'registration_closed'].includes(availability ?? '')
          ? 'registration_closed'
          : input.waitlist === true || ['waitlist', 'waitlisted'].includes(availability ?? '')
            ? 'waitlist'
            : input.approval === true
              ? 'approval_required'
              : input.available === true || availability === 'available'
                ? 'available'
                : 'unknown',
    currency: input.currency,
    priceNotes: input.priceNotes,
    venueId: input.venueId,
    neighborhood: input.neighborhood,
    locationVisibility: input.locationVisibility,
    categories,
    music,
    issues,
  });
}

export function sourceEnd(start: unknown, end: unknown): string | undefined {
  const s = sourceTime(start),
    e = sourceTime(end);
  return e && (!s || e > s) ? e : undefined;
}
