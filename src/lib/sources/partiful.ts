import { EventSource, RawCandidate, RawCandidateSchema, type SourceFetchOptions } from './types';
import { politeFetchJson, politeFetchText } from './polite-fetch';
import { eventDetails, sourceTime, sourceEnd, sourceUrl } from './normalize';

/**
 * Partiful connector (Next.js on Vercel).
 *
 * Flow: GET /discover → parse `__NEXT_DATA__` (buildId + trendingSections.NYC
 * item ids) → hydrate each event via the `/_next/data/<buildId>/e/<id>.json`
 * route → breadth-first expand each response's `similarEvents` to depth 2.
 * Capped at 60 hydrated events; NYC-only (unknown-region items are kept — the
 * events rule keeps unlocated/unclassified entries).
 */

const DISCOVER_URL = 'https://partiful.com/discover';
const MAX_EVENTS = 60;
const MAX_DEPTH = 2;

interface DiscoverPage {
  buildId: string;
  nycEventIds: string[];
}

interface Hydrated {
  event: Record<string, unknown>;
  similar: unknown[];
}

// ---- defensive parsing helpers (event payloads are untyped upstream) ----

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Discover-page items carry an `event-`-prefixed id (`event-nP2El…`), while the
 * `/e/<id>` page, the `/_next/data` route and `similarEvents` all use the bare
 * id. Strip the prefix so every id in the BFS is in the bare form.
 */
function bareEventId(id: string): string {
  return id.replace(/^event-/, '');
}

function isNycOrUnknownRegion(item: unknown): boolean {
  const region = asString(asRecord(item)?.region);
  return region === undefined || region.toUpperCase() === 'NYC';
}

// ---- discover page parsing ----

function extractNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

function parseDiscover(html: string): DiscoverPage | null {
  const data = asRecord(extractNextData(html));
  const buildId = asString(data?.buildId);
  if (!buildId) return null;

  const pageProps = asRecord(asRecord(asRecord(data?.props)?.pageProps));
  const trending = asRecord(pageProps?.trendingSections);
  const nycEventIds: string[] = [];
  if (!trending) return null;
  if (trending) {
    for (const [region, section] of Object.entries(trending)) {
      if (region.toUpperCase() !== 'NYC') continue;
      const items = asRecord(section)?.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const raw = asString(asRecord(item)?.id);
        const id = raw ? bareEventId(raw) : undefined;
        if (id && !nycEventIds.includes(id)) nycEventIds.push(id);
      }
    }
  }
  return { buildId, nycEventIds };
}

// ---- fetch steps (discovery failure is fatal; partial hydration is reported) ----

async function fetchDiscover(): Promise<DiscoverPage> {
  const html = await politeFetchText(DISCOVER_URL);
  const page = parseDiscover(html);
  if (!page) throw new Error('[partiful] discover: missing or malformed discovery data');
  return page;
}

async function hydrateEvent(buildId: string, id: string): Promise<Hydrated | null> {
  try {
    const data = await politeFetchJson<unknown>(
      `https://partiful.com/_next/data/${buildId}/e/${id}.json`
    );
    // The `/_next/data` route returns `{ pageProps }` at the top level; the
    // discover page's inlined `__NEXT_DATA__` nests it under `props`. Accept both.
    const root = asRecord(data);
    const pageProps = asRecord(root?.pageProps) ?? asRecord(asRecord(root?.props)?.pageProps);
    const event = asRecord(pageProps?.event);
    if (!event) {
      console.warn(`[partiful] event ${id}: missing pageProps.event`);
      return null;
    }
    const similar = Array.isArray(pageProps?.similarEvents) ? pageProps.similarEvents : [];
    return { event, similar };
  } catch (err) {
    console.warn(`[partiful] event ${id}: hydration failed:`, err);
    return null;
  }
}

// ---- normalization ----

export function normalizePartifulEvent(
  id: string,
  event: Record<string, unknown>
): RawCandidate | null {
  const title = asString(event.title) ?? asString(event.name);
  if (!title) return null;

  const locationInfo = asRecord(event.locationInfo);
  const mapsInfo = asRecord(locationInfo?.mapsInfo);
  const hidden = locationInfo?.type === 'hidden' || locationInfo?.type === 'tbd';
  const addressLines = hidden
    ? undefined
    : (locationInfo?.displayAddressLines ?? locationInfo?.addressLines ?? mapsInfo?.addressLines);

  const hype: Record<string, unknown> = {};
  const going = asNumber(event.goingGuestCount);
  const approved = asNumber(event.approvedGuestCount);
  if (going !== undefined) hype.goingGuestCount = going;
  if (approved !== undefined) hype.approvedGuestCount = approved;

  const address = Array.isArray(addressLines)
    ? addressLines
        .map((line) => asString(line) ?? '')
        .filter((line) => line.length > 0)
        .join(', ') || undefined
    : asString(addressLines);

  const candidate: RawCandidate = {
    source: 'partiful',
    sourceId: id,
    sourceUrl:
      sourceUrl(event.publicShortUrl, 'https://partiful.com/', [
        'partiful.com',
        'go.partiful.com',
      ]) ?? `https://partiful.com/e/${encodeURIComponent(id)}`,
    title,
    description: asString(event.description),
    startsAt: sourceTime(event.startDate),
    endsAt: sourceEnd(event.startDate, event.endDate),
    venueName: hidden
      ? undefined
      : (asString(locationInfo?.displayName) ?? asString(mapsInfo?.name)),
    address,
    details: eventDetails({
      title,
      description: asString(event.description),
      startsAt: event.startDate,
      endsAt: event.endDate,
      status: event.status,
      cancelled: event.isCancelled ?? event.isCanceled,
      closed: event.rsvpsEnabled === false || event.atCapacity === true,
      locationVisibility: hidden ? 'hidden' : address ? 'public' : 'unknown',
      neighborhood: asString(locationInfo?.neighborhood),
    }),
    hype,
    tags: [],
    raw: event,
  };

  const parsed = RawCandidateSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn(`[partiful] event ${id}: failed RawCandidate validation:`, parsed.error.message);
    return null;
  }
  return parsed.data;
}

// ---- BFS: discover → hydrate → similarEvents (depth 2, cap 60) ----

export async function fetchPartifulCandidates(
  options: SourceFetchOptions = {}
): Promise<RawCandidate[]> {
  if (process.env.SOURCE_PARTIFUL_ENABLED === 'false') return [];
  const discover = await fetchDiscover();
  if (!discover || discover.nycEventIds.length === 0) return [];
  const { buildId, nycEventIds } = discover;

  const queue: { id: string; depth: number }[] = nycEventIds.map((id) => ({ id, depth: 0 }));
  const enqueued = new Set<string>(nycEventIds);
  let attempts = 0;
  const candidates: RawCandidate[] = [];

  let head = 0;
  while (head < queue.length && attempts < MAX_EVENTS) {
    const { id, depth } = queue[head++];
    attempts++;
    const hydrated = await hydrateEvent(buildId, id);
    if (!hydrated) {
      options.onWarning?.(`Event ${id} could not be refreshed; coverage is partial.`);
      continue;
    }

    const candidate = normalizePartifulEvent(id, hydrated.event);
    if (candidate) candidates.push(candidate);
    else console.warn(`[partiful] event ${id}: skipped (invalid candidate)`);

    if (depth < MAX_DEPTH) {
      for (const similar of hydrated.similar) {
        if (!isNycOrUnknownRegion(similar)) continue;
        const rawSimilarId = asString(asRecord(similar)?.id);
        const similarId = rawSimilarId ? bareEventId(rawSimilarId) : undefined;
        if (!similarId || enqueued.has(similarId)) continue;
        enqueued.add(similarId);
        queue.push({ id: similarId, depth: depth + 1 });
      }
    }
  }
  if (attempts > 0 && candidates.length === 0)
    throw new Error('[partiful] no usable events hydrated from discovery seeds');
  return candidates;
}

export const partifulSource: EventSource = {
  name: 'partiful',
  enabled(): boolean {
    return process.env.SOURCE_PARTIFUL_ENABLED !== 'false';
  },
  fetchCandidates: fetchPartifulCandidates,
};
