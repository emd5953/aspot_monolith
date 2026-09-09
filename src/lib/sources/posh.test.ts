import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The Posh connector is mocked at the network boundary (politeFetchJson) and
 * exercised against a realistic BFF-shaped fixture. These tests lock in:
 * normalization (ids, ISO-with-offset dates, slug URL building), defensive
 * skipping of invalid items, pagination stops (empty page / repeated page /
 * max pages), and the env-flag gate.
 */

vi.mock('./polite-fetch', () => ({
  politeFetchJson: vi.fn(),
}));

import { politeFetchJson } from './polite-fetch';
import { poshSource, extractEvents } from './posh';

const politeFetchJsonMock = vi.mocked(politeFetchJson);

/** One plausible event from the posh.vip BFF explore response. */
const poshEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt_001',
  slug: 'rooftop-sunset-sessions',
  title: 'Rooftop Sunset Sessions',
  description: 'House music on a Lower East Side rooftop with skyline views.',
  startsAt: '2026-09-05T18:00:00-04:00',
  endAt: '2026-09-05T23:00:00-04:00',
  venue: {
    name: 'The Loft at Essex',
    address: '120 Essex St, New York, NY 10002',
    latitude: 40.7182,
    longitude: -73.9844,
  },
  priceMin: 25,
  priceMax: 60,
  isFree: false,
  attendingCount: 342,
  tags: ['music', 'rooftop'],
  ...overrides,
});

/** Page-shaped envelope matching the recon'd BFF (cursor = offset). */
const bffPage = (events: Record<string, unknown>[], cursor: number): Record<string, unknown> => ({
  data: {
    events,
    cursor,
    hasMore: true,
  },
});

const VALID_ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

describe('poshSource', () => {
  beforeEach(() => {
    politeFetchJsonMock.mockReset();
    delete process.env.SOURCE_POSH_ENABLED;
  });

  afterEach(() => {
    delete process.env.SOURCE_POSH_ENABLED;
  });

  describe('enabled()', () => {
    it('defaults to on', () => {
      expect(poshSource.enabled()).toBe(true);
    });

    it('is off when SOURCE_POSH_ENABLED=false', () => {
      process.env.SOURCE_POSH_ENABLED = 'false';
      expect(poshSource.enabled()).toBe(false);
    });

    it('stays on for any other value', () => {
      process.env.SOURCE_POSH_ENABLED = 'true';
      expect(poshSource.enabled()).toBe(true);
      process.env.SOURCE_POSH_ENABLED = '0';
      expect(poshSource.enabled()).toBe(true);
    });
  });

  describe('fetchCandidates — normalization', () => {
    it('maps a well-formed event into a RawCandidate', async () => {
      politeFetchJsonMock.mockResolvedValueOnce(bffPage([poshEvent()], 25));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      const c = out[0];
      expect(c.source).toBe('posh');
      expect(c.sourceId).toBe('evt_001');
      expect(c.sourceUrl).toBe('https://posh.vip/e/rooftop-sunset-sessions');
      expect(c.title).toBe('Rooftop Sunset Sessions');
      expect(c.description).toContain('House music');
      expect(c.startsAt).toBe('2026-09-05T18:00:00-04:00');
      expect(c.endsAt).toBe('2026-09-05T23:00:00-04:00');
      expect(c.startsAt).toMatch(VALID_ISO_OFFSET);
      expect(c.venueName).toBe('The Loft at Essex');
      expect(c.address).toBe('120 Essex St, New York, NY 10002');
      expect(c.lat).toBeCloseTo(40.7182);
      expect(c.lng).toBeCloseTo(-73.9844);
      expect(c.priceMin).toBe(25);
      expect(c.priceMax).toBe(60);
      expect(c.isFree).toBe(false);
      expect(c.hype).toEqual({ attending: 342 });
      expect(c.tags).toEqual(['music', 'rooftop']);
      // untouched provenance payload
      expect(c.raw).toMatchObject({ id: 'evt_001' });
    });

    it('falls back to slug as sourceId and ISO-normalizes a UTC date', async () => {
      const ev = poshEvent({ id: undefined, startsAt: '2026-09-06T02:00:00.000Z', endAt: undefined });
      politeFetchJsonMock.mockResolvedValueOnce(bffPage([ev], 25));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      expect(out[0].sourceId).toBe('rooftop-sunset-sessions');
      expect(out[0].startsAt).toBe('2026-09-06T02:00:00+00:00');
      expect(out[0].endsAt).toBeUndefined();
    });

    it('coerces numeric-string prices and snake_case attending fields', async () => {
      const ev = poshEvent({
        priceMin: '30',
        attendingCount: undefined,
        attending_count: 88,
      });
      politeFetchJsonMock.mockResolvedValueOnce(bffPage([ev], 25));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      expect(out[0].priceMin).toBe(30);
      expect(out[0].hype).toEqual({ attending: 88 });
    });
  });

  describe('fetchCandidates — defensive skipping', () => {
    it('skips items missing a title or an id+slug and keeps the rest', async () => {
      const events = [
        poshEvent({ id: 'evt_002', title: '', slug: 'no-title' }), // no title
        poshEvent({ id: null, slug: undefined, title: 'No ID' }), // no id or slug
        poshEvent({ id: 'evt_003', slug: 'keep-me', title: 'Keep Me' }),
      ];
      politeFetchJsonMock.mockResolvedValueOnce(bffPage(events, 25));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      expect(out[0].sourceId).toBe('evt_003');
    });

    it('skips events whose coordinates are out of range for RawCandidateSchema', async () => {
      const badVenue = { name: 'Nowhere', address: 'Off Map', latitude: 95, longitude: -73.9 };
      const events = [
        poshEvent({ id: 'evt_bad', slug: 'bad-coords', title: 'Bad Coords', venue: badVenue }),
        poshEvent({ id: 'evt_ok', slug: 'ok', title: 'Ok' }),
      ];
      politeFetchJsonMock.mockResolvedValueOnce(bffPage(events, 25));

      const out = await poshSource.fetchCandidates();

      expect(out.map((c) => c.sourceId)).toEqual(['evt_ok']);
    });
  });

  describe('fetchCandidates — pagination', () => {
    it('pages via cursor offsets and stops on an empty page', async () => {
      const page1Events = Array.from({ length: 2 }, (_, i) =>
        poshEvent({ id: `evt_${i}`, slug: `ev-${i}`, title: `Event ${i}` })
      );
      politeFetchJsonMock
        .mockResolvedValueOnce(bffPage(page1Events, 25))
        .mockResolvedValueOnce(bffPage([], 50));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(2);
      expect(politeFetchJsonMock).toHaveBeenCalledTimes(2);
      const firstUrl = politeFetchJsonMock.mock.calls[0][0] as string;
      const secondUrl = politeFetchJsonMock.mock.calls[1][0] as string;
      expect(firstUrl).toContain('https://posh.vip/api/bff/v1/explore/events?');
      expect(firstUrl).toContain('cursor=0');
      expect(firstUrl).toContain('lat=40.7128');
      expect(firstUrl).toContain('lng=-74.006');
      expect(secondUrl).toContain('cursor=25'); // reads next cursor from the response
    });

    it('stops when a page repeats the previous items (no fresh ids)', async () => {
      const dup = poshEvent({ id: 'evt_dup', slug: 'dup', title: 'Dup' });
      politeFetchJsonMock
        .mockResolvedValueOnce(bffPage([dup], 25))
        .mockResolvedValueOnce(bffPage([dup], 50))
        .mockResolvedValueOnce(bffPage([dup], 75));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      expect(politeFetchJsonMock).toHaveBeenCalledTimes(2);
    });

    it('caps pagination at 5 pages', async () => {
      const page = (offset: number) =>
        bffPage([poshEvent({ id: `evt_${offset}`, slug: `s-${offset}`, title: `E${offset}` })], offset + 25);
      for (let i = 0; i < 8; i++) politeFetchJsonMock.mockResolvedValueOnce(page(i * 25));

      const out = await poshSource.fetchCandidates();

      expect(politeFetchJsonMock).toHaveBeenCalledTimes(5);
      expect(out).toHaveLength(5);
    });

    it('stops after a fetch error and still returns earlier pages', async () => {
      const page1 = bffPage([poshEvent({ id: 'evt_p1', slug: 'p1', title: 'P1' })], 25);
      politeFetchJsonMock
        .mockResolvedValueOnce(page1)
        .mockRejectedValueOnce(new Error('politeFetch 503'));

      const out = await poshSource.fetchCandidates();

      expect(out).toHaveLength(1);
      expect(out[0].sourceId).toBe('evt_p1');
    });

    it('parses both envelope variants (data.events and top-level events)', () => {
      expect(extractEvents({ data: { events: [1] } })).toEqual([1]);
      expect(extractEvents({ events: [2] })).toEqual([2]);
      expect(extractEvents({ data: { data: { events: [3] } } })).toEqual([]);
      expect(extractEvents({ results: [4] })).toEqual([4]);
      expect(extractEvents({ data: [5] })).toEqual([5]);
      expect(extractEvents({})).toEqual([]);
      expect(extractEvents(null)).toEqual([]);
    });
  });

  it('throws when the first page fails, so ingest reports an outage not an empty night', async () => {
    // posh.vip returns 403 to datacenter IPs; swallowing that made /api/ingest
    // answer ok:true with fetched:0, indistinguishable from a quiet night.
    politeFetchJsonMock.mockRejectedValueOnce(new Error('politeFetch ... -> 403 Forbidden'));

    await expect(poshSource.fetchCandidates()).rejects.toThrow('403');
  });
});
