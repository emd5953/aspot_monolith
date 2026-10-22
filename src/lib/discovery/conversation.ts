import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DiscoveryIntentSchema,
  DiscoveryResponseSchema,
  type DiscoveryRequest,
  type DiscoveryIntent,
  type DiscoveryResponse,
  type EventRecommendation,
} from '@/lib/ai/schemas/discovery';
import { nycDate, nycNightDate, nycNightWindow } from '@/lib/time/nyc';
import {
  dedupeRows,
  getTonightPool,
  isFresh,
  isRecommendable,
  type PoolCandidateRow,
} from '@/lib/sources/pool-service';
import { MUSIC_PATTERNS } from '@/lib/sources/normalize';

const GENRE_NAMES: Record<string, string> = {
  rnb: 'R&B',
  hip_hop: 'hip-hop',
  afrobeats: 'Afrobeats',
  house: 'house music',
  techno: 'techno',
  jazz: 'jazz',
  salsa: 'salsa',
};
const AREAS = [
  'bushwick',
  'williamsburg',
  'greenpoint',
  'harlem',
  'brooklyn',
  'manhattan',
  'queens',
  'bronx',
  'staten island',
  'lower east side',
  'east village',
  'greenwich village',
  'midtown',
  'soho',
];
const plusDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/** Small explicit vocabulary for the first adapter; no fabricated semantic fit. */
export function parseConversation(
  request: DiscoveryRequest,
  now: Date
): { intent: DiscoveryIntent; clarification?: string } {
  let intent: DiscoveryIntent = { date: nycNightDate(now), genres: [], freeOnly: false };
  let clarification: string | undefined;
  let needsDate = false,
    needsMusic = false;
  for (const message of request.messages.filter((m) => m.role === 'user')) {
    const s = message.content.toLowerCase();
    if (/\b(start over|reset)\b/.test(s)) {
      intent = { date: nycNightDate(now), genres: [], freeOnly: false };
      needsDate = false;
      needsMusic = false;
    }
    const negativeMusic =
      /\b(not|no|avoid|except)\s+(r&b|rnb|house|techno|jazz|hip.hop|afrobeats)/.test(s);
    let understood = false;
    const genres = Object.entries(MUSIC_PATTERNS)
      .filter(([, pattern]) => pattern.test(s))
      .map(([genre]) => genre);
    if (/\bhouse\b/.test(s) && !genres.includes('house')) genres.push('house');
    if (genres.length && !negativeMusic) {
      intent.genres = genres;
      understood = true;
      needsMusic = false;
    }
    if (/\b(any music|any genre|anything|surprise me)\b/.test(s)) {
      intent.genres = [];
      intent.category ??= 'nightlife';
      understood = true;
      needsMusic = false;
    }
    if (/\b(party|dance|dancing|nightlife|club)\b/.test(s)) {
      intent.category = 'nightlife';
      understood = true;
    }
    if (/\b(live music|concert|live jazz)\b/.test(s)) {
      intent.category = 'live_music';
      understood = true;
    }
    if (/\b(social|mixer|meetup|meet people)\b/.test(s)) {
      intent.category = 'social';
      understood = true;
    }
    const area = AREAS.find((a) => s.includes(a));
    if (area) {
      intent.area = area;
      understood = true;
    }
    if (/\b(anywhere|all nyc|all boroughs)\b/.test(s)) {
      delete intent.area;
      understood = true;
    }
    if (/\b(free|no cover)\b/.test(s)) {
      intent.freeOnly = true;
      intent.maxPrice = 0;
      understood = true;
    }
    const price = /(?:under|up to|less than|maximum|max)\s*\$?\s*(\d+(?:\.\d{1,2})?)/.exec(s);
    if (price) {
      intent.maxPrice = Number(price[1]);
      understood = true;
      intent.freeOnly = intent.maxPrice === 0;
    }
    if (/\b(any price|any budget|no budget limit)\b/.test(s)) {
      delete intent.maxPrice;
      understood = true;
      intent.freeOnly = false;
    }
    const explicitDate = /\b(\d{4}-\d{2}-\d{2})\b/.exec(s)?.[1];
    const weekday = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(s)?.[1];
    if (explicitDate) intent.date = explicitDate;
    else if (/\btomorrow\b/.test(s)) intent.date = plusDays(nycDate(now), 1);
    else if (/\btoday\b/.test(s)) intent.date = nycDate(now);
    else if (/\btonight\b/.test(s)) intent.date = nycNightDate(now);
    else if (weekday) {
      const today = nycDate(now),
        day = new Date(`${today}T12:00:00Z`).getUTCDay();
      const target = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ].indexOf(weekday);
      intent.date = plusDays(today, (target - day + 7) % 7);
    }
    if (explicitDate || weekday || /\b(tonight|today|tomorrow)\b/.test(s)) {
      understood = true;
      needsDate = false;
    }
    const valid = new Date(`${intent.date}T12:00:00Z`);
    if (
      !Number.isFinite(valid.getTime()) ||
      valid.toISOString().slice(0, 10) !== intent.date ||
      intent.date < nycNightDate(now) ||
      intent.date > plusDays(nycDate(now), 14)
    ) {
      needsDate = true;
      intent.date = nycNightDate(now);
    }
    if (/\b(weekend|next week|next month|later|after midnight)\b/.test(s) && !explicitDate)
      needsDate = true;
    if (negativeMusic) needsMusic = true;
    if (needsDate) {
      clarification =
        'Which night in the next two weeks? Send a date as YYYY-MM-DD; I include events through 6am the next morning.';
    } else if (needsMusic) {
      clarification =
        'Which music would you like instead? I can match explicit R&B, hip-hop, Afrobeats, house, techno, jazz, or salsa mentions.';
    } else if (!intent.genres.length && !intent.category) {
      clarification =
        'What sounds good: R&B, dancing, live music, or meeting people? You can add a borough and budget.';
    } else if (understood) {
      clarification = undefined;
    } else {
      clarification =
        'I can filter by music, NYC area, night, and budget. Which of those would you like to change?';
    }
  }
  return { intent: DiscoveryIntentSchema.parse(intent), clarification };
}

function priceLabel(row: PoolCandidateRow): string {
  if (row.is_free === true) return 'Listed as free; check entry conditions';
  if (row.price_min == null && row.price_max == null) return 'Price not listed';
  const currency = row.details?.currency;
  const prefix = currency === 'USD' ? '$' : currency ? `${currency} ` : '';
  const suffix = currency ? '' : ' (currency not listed)';
  if (row.price_min != null && row.price_max != null && row.price_max !== row.price_min)
    return `${prefix}${row.price_min}–${prefix}${row.price_max}${suffix}; fees may apply`;
  return `${row.price_min != null ? 'From ' : 'Up to '}${prefix}${row.price_min ?? row.price_max}${suffix}; fees may apply`;
}

function recommendation(
  row: PoolCandidateRow,
  intent: DiscoveryIntent,
  now: Date
): EventRecommendation | null {
  const evidence = row.details?.music.filter((m) => intent.genres.includes(m.genre)) ?? [];
  if (intent.genres.length && evidence.length === 0) return null;
  if (intent.category && !row.details?.categories.includes(intent.category)) return null;
  const locationText = [row.venue_name, row.address, row.details?.neighborhood]
    .filter(Boolean)
    .join(' — ');
  if (intent.area && !locationText.toLowerCase().includes(intent.area)) return null;
  if (intent.freeOnly && row.is_free !== true) return null;
  if (
    intent.maxPrice !== undefined &&
    row.is_free !== true &&
    (row.price_min == null || row.details?.currency !== 'USD' || row.price_min > intent.maxPrice)
  )
    return null;
  const caveats = [...(row.details?.issues ?? []), ...(row.conflicts ?? [])];
  if (!row.ends_at) caveats.push('End time not listed.');
  if (!row.venue_name && !row.address) caveats.push('Exact venue/address not published.');
  if (!row.details?.availability || row.details.availability === 'unknown')
    caveats.push('Ticket availability is unconfirmed; check the source.');
  if (now.getTime() - Date.parse(row.fetched_at) > 4 * 3600_000)
    caveats.push('Listing was checked over four hours ago; reconfirm before leaving.');
  if (row.details?.priceNotes) caveats.push(row.details.priceNotes);
  if (intent.maxPrice !== undefined && row.is_free !== true)
    caveats.push('Starting price fits your budget; ticket tiers and fees may cost more.');
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(row.starts_at!));
  const reasons = evidence.map(
    (e) => `Listing mentions ${GENRE_NAMES[e.genre] ?? e.genre}: “${e.evidence}”`
  );
  if (intent.area) reasons.push(`Published location includes ${intent.area}.`);
  if (!reasons.length) reasons.push('Listing explicitly describes the requested event category.');
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at!,
    endsAt: row.ends_at,
    when,
    location: locationText || 'Location not announced',
    price: priceLabel(row),
    availability: (row.details?.availability ?? 'unknown').replaceAll('_', ' '),
    reasons,
    caveats,
    sources: row.listings?.length
      ? row.listings
      : [{ source: row.source, url: row.source_url!, fetchedAt: row.fetched_at }],
  };
}

export function recommendFromPool(
  rows: PoolCandidateRow[],
  intent: DiscoveryIntent,
  now: Date
): EventRecommendation[] {
  const window = nycNightWindow(intent.date);
  return dedupeRows(rows.filter((row) => isFresh(row, now)))
    .filter((row) => isRecommendable(row, window.from, window.to, now))
    .map((row) => recommendation(row, intent, now))
    .filter((r): r is EventRecommendation => r !== null)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, 5);
}

/** Inject the pool and clock for deterministic end-to-end conversation tests. */
export async function runDiscoveryConversation(
  request: DiscoveryRequest,
  dependencies: {
    now?: Date;
    readPool: (window: { from: Date; to: Date; now: Date }) => Promise<PoolCandidateRow[]>;
  }
): Promise<DiscoveryResponse> {
  const now = dependencies.now ?? new Date();
  const { intent, clarification } = parseConversation(request, now);
  if (clarification)
    return DiscoveryResponseSchema.parse({
      intent,
      status: 'clarification',
      reply: clarification,
      recommendations: [],
    });
  const rows = await dependencies.readPool({ ...nycNightWindow(intent.date), now });
  const recommendations = recommendFromPool(rows, intent, now);
  const reply = recommendations.length
    ? `For the night of ${intent.date} in NYC:\n\n` +
      recommendations
        .map(
          (r) =>
            `${r.title}\n${r.when} · ${r.location}\n${r.price} · Tickets: ${r.availability} (source report)\n${r.reasons.join(' ')}\n${r.caveats.join(' ')}\n${r.sources.map((s) => s.url).join('\n')}`
        )
        .join('\n\n')
    : 'I found no fresh, source-backed matches in the current pool. That does not mean nothing is happening. Try another area, budget, music style, or night.';
  return DiscoveryResponseSchema.parse({
    intent,
    status: recommendations.length ? 'recommendations' : 'no_matches',
    reply,
    recommendations,
  });
}

export function discoverConversation(
  supabase: SupabaseClient,
  request: DiscoveryRequest
): Promise<DiscoveryResponse> {
  return runDiscoveryConversation(request, {
    readPool: (window) => getTonightPool(supabase, window),
  });
}
