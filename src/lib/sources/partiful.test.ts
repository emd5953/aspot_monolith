import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { politeFetchJson, politeFetchText } from './polite-fetch';
import { partifulSource } from './partiful';

vi.mock('./polite-fetch', () => ({
  politeFetchJson: vi.fn(),
  politeFetchText: vi.fn(),
}));

const mockText = politeFetchText as unknown as Mock;
const mockJson = politeFetchJson as unknown as Mock;

const BUILD_ID = 'build-1';
const DISCOVER_URL = 'https://partiful.com/discover';
const dataUrl = (id: string) => `https://partiful.com/_next/data/${BUILD_ID}/e/${id}.json`;

// ---- inline fixtures ----

function discoverHtml(nycIds: string[]): string {
  const nextData = {
    buildId: BUILD_ID,
    props: {
      pageProps: {
        trendingSections: {
          NYC: {
            id: 'nyc-dynamic-trending-events',
            title: 'Trending in NYC',
            items: nycIds.map((id) => ({ id, title: `Trending item ${id}` })),
          },
          LA: {
            id: 'la-dynamic-trending-events',
            title: 'Trending in LA',
            items: [{ id: 'ev-la' }],
          },
        },
      },
    },
  };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    nextData
  )}</script></body></html>`;
}

const DEFAULT_TWO_IDS = ['ev-1', 'ev-2'];

function eventJson(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Event ${id}`,
    startDate: '2026-09-05T22:00:00.000Z',
    endDate: '2026-09-06T04:00:00.000Z',
    description: `Description for ${id}`,
    locationInfo: {
      mapsInfo: { name: 'Space Bushwick' },
      addressLines: ['839 Broadway', 'Brooklyn'],
    },
    publicShortUrl: `https://partiful.com/s/${id}`,
    goingGuestCount: 120,
    approvedGuestCount: 80,
    region: 'NYC',
    ...overrides,
  };
}

/** Core fixture: ev-1 → {ev-2 dupe, ev-la (LA, skipped), ev-3}; ev-2 → ev-3; ev-3 lacks title. */
function coreResponses(): Record<string, unknown> {
  return {
    'ev-1': {
      props: {
        pageProps: {
          event: eventJson('ev-1'),
          similarEvents: [
            eventJson('ev-2'),
            eventJson('ev-la', { region: 'LA' }),
            eventJson('ev-3'),
          ],
        },
      },
    },
    'ev-2': {
      props: {
        pageProps: {
          event: eventJson('ev-2', { publicShortUrl: undefined }),
          similarEvents: [eventJson('ev-3')],
        },
      },
    },
    'ev-3': {
      props: {
        pageProps: {
          event: eventJson('ev-3', { title: undefined }),
          similarEvents: [],
        },
      },
    },
  };
}

function idFromUrl(url: string): string {
  const match = /\/e\/([^/.?]+)\.json/.exec(url);
  return match ? match[1] : '';
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SOURCE_PARTIFUL_ENABLED;
  mockText.mockResolvedValue(discoverHtml(DEFAULT_TWO_IDS));
  const responses = coreResponses();
  mockJson.mockImplementation(async (url: string) => {
    const id = idFromUrl(url);
    const res = responses[id];
    if (!res) throw new Error(`unexpected hydration url: ${url}`);
    return res;
  });
});

afterEach(() => {
  delete process.env.SOURCE_PARTIFUL_ENABLED;
});

describe('partifulSource', () => {
  it('exposes name and enabled() driven by SOURCE_PARTIFUL_ENABLED', () => {
    expect(partifulSource.name).toBe('partiful');
    expect(partifulSource.enabled()).toBe(true);
    process.env.SOURCE_PARTIFUL_ENABLED = 'false';
    expect(partifulSource.enabled()).toBe(false);
    process.env.SOURCE_PARTIFUL_ENABLED = '1';
    expect(partifulSource.enabled()).toBe(true);
  });

  it('extracts buildId and hydrates via the _next/data route', async () => {
    const candidates = await partifulSource.fetchCandidates();
    expect(mockText).toHaveBeenCalledWith(DISCOVER_URL);
    expect(mockJson).toHaveBeenCalledWith(dataUrl('ev-1'));
    expect(mockJson).toHaveBeenCalledWith(dataUrl('ev-2'));
    // LA trending item is never hydrated.
    expect(mockJson).not.toHaveBeenCalledWith(dataUrl('ev-la'));
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('BFS-expands similarEvents to depth 2 with dedupe, and skips invalid events', async () => {
    const candidates = await partifulSource.fetchCandidates();

    // ev-1 and ev-2 are valid; ev-3 (chained via similarEvents) lacks a title.
    expect(candidates.map((c) => c.sourceId)).toEqual(['ev-1', 'ev-2']);

    // ev-3 was reached via similarEvents chaining and hydrated exactly once
    // (dedupe: it was referenced by both ev-1 and ev-2).
    expect(mockJson).toHaveBeenCalledWith(dataUrl('ev-3'));
    const ev3Fetches = mockJson.mock.calls.filter((call) => call[0] === dataUrl('ev-3'));
    expect(ev3Fetches).toHaveLength(1);
  });

  it('normalizes hydrated events into RawCandidate fields', async () => {
    const candidates = await partifulSource.fetchCandidates();
    const first = candidates.find((c) => c.sourceId === 'ev-1');
    expect(first).toBeDefined();
    expect(first!.source).toBe('partiful');
    expect(first!.title).toBe('Event ev-1');
    expect(first!.description).toBe('Description for ev-1');
    expect(first!.startsAt).toBe('2026-09-05T22:00:00.000Z');
    expect(first!.endsAt).toBe('2026-09-06T04:00:00.000Z');
    expect(first!.venueName).toBe('Space Bushwick');
    expect(first!.address).toBe('839 Broadway, Brooklyn');
    expect(first!.hype).toEqual({ goingGuestCount: 120, approvedGuestCount: 80 });
    expect(first!.raw).toEqual(eventJson('ev-1'));
  });

  it('falls back to https://partiful.com/e/<id> when publicShortUrl is absent', async () => {
    const candidates = await partifulSource.fetchCandidates();
    const second = candidates.find((c) => c.sourceId === 'ev-2');
    expect(second).toBeDefined();
    expect(second!.sourceUrl).toBe('https://partiful.com/e/ev-2');
    const first = candidates.find((c) => c.sourceId === 'ev-1');
    expect(first!.sourceUrl).toBe('https://partiful.com/s/ev-1');
  });

  it('caps hydration at 60 events', async () => {
    const ids = Array.from({ length: 70 }, (_, i) => `cap-${i}`);
    mockText.mockResolvedValue(discoverHtml(ids));
    mockJson.mockImplementation(async (url: string) => ({
      props: { pageProps: { event: eventJson(idFromUrl(url)), similarEvents: [] } },
    }));

    const candidates = await partifulSource.fetchCandidates();
    expect(candidates).toHaveLength(60);
    expect(mockJson).toHaveBeenCalledTimes(60);
  });

  it('returns [] when __NEXT_DATA__ is missing or malformed', async () => {
    mockText.mockResolvedValue('<html><body>no data here</body></html>');
    expect(await partifulSource.fetchCandidates()).toEqual([]);
    expect(mockJson).not.toHaveBeenCalled();

    mockText.mockResolvedValue(
      '<script id="__NEXT_DATA__" type="application/json">{definitely not json</script>'
    );
    expect(await partifulSource.fetchCandidates()).toEqual([]);
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('continues when similarEvents is missing entirely', async () => {
    mockText.mockResolvedValue(discoverHtml(['ev-solo']));
    const responses: Record<string, unknown> = {
      'ev-solo': { props: { pageProps: { event: eventJson('ev-solo') } } },
    };
    mockJson.mockImplementation(async (url: string) => {
      const res = responses[idFromUrl(url)];
      if (!res) throw new Error(`unexpected hydration url: ${url}`);
      return res;
    });

    const candidates = await partifulSource.fetchCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceId).toBe('ev-solo');
  });

  it('logs and continues when an event hydration fetch throws', async () => {
    mockText.mockResolvedValue(discoverHtml(['ev-1', 'ev-2']));
    mockJson.mockImplementation(async (url: string) => {
      if (url === dataUrl('ev-1')) throw new Error('503 from CDN');
      return coreResponses()[idFromUrl(url)];
    });

    const candidates = await partifulSource.fetchCandidates();
    expect(candidates.map((c) => c.sourceId)).toEqual(['ev-2']);
  });
});
