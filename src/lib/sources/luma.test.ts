import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lumaSource } from './luma';
import { politeFetchJson } from './polite-fetch';

vi.mock('./polite-fetch', () => ({
  politeFetchJson: vi.fn(),
  sleep: vi.fn(),
}));

const mockedFetch = vi.mocked(politeFetchJson);

/** Inline fixture mimicking {entries, has_more, next_cursor}. */
function makeEntry(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    event: {
      api_id: 'evt-default',
      name: 'Default Event',
      description: 'A default test event',
      start_at: '2026-09-10T18:00:00.000Z',
      end_at: '2026-09-10T21:00:00.000Z',
      timezone: 'America/New_York',
      url: 'default-slug',
      cover_url: 'https://cdn.lu.ma/cover.jpg',
    },
    coordinate: { latitude: 40.7431, longitude: -73.9927 },
    geo_address_info: { city: 'New York', region: 'NY', country: 'US' },
    guest_count: 120,
    ticket_count: 45,
    ticket_info: { type: 'paid', free: false },
    hosts: [],
    ...overrides,
  };
}

const ENTRIES = [
  // Obfuscated address but precise coordinates.
  makeEntry({
    event: {
      api_id: 'evt-obf-1',
      name: 'Rooftop Listening Session',
      start_at: '2026-09-12T22:00:00.000Z',
      end_at: '2026-09-13T02:00:00.000Z',
      url: 'rooftop-listening',
    },
    coordinate: { latitude: 40.7191, longitude: -73.9579 },
    geo_address_info: { city: 'Brooklyn', region: 'NY', country: 'US' },
    guest_count: 87,
    ticket_count: 30,
  }),
  // Free event.
  makeEntry({
    event: {
      api_id: 'evt-free-2',
      name: 'Free Community Picnic',
      start_at: '2026-09-14T16:00:00.000Z',
      end_at: '2026-09-14T19:00:00.000Z',
      url: 'community-picnic',
    },
    coordinate: { latitude: 40.7789, longitude: -73.9638 },
    geo_address_info: { city: 'New York', region: 'NY', country: 'US' },
    guest_count: 240,
    ticket_info: { type: 'free', free: true },
  }),
  // Invalid: no name.
  makeEntry({
    event: {
      api_id: 'evt-invalid-3',
      name: '',
      start_at: '2026-09-15T16:00:00.000Z',
      timezone: 'America/New_York',
    },
  }),
];

const PAGE_ONE = { entries: ENTRIES, has_more: true, next_cursor: 'cursor-page-2' };
const PAGE_TWO = { entries: [ENTRIES[0]], has_more: false, next_cursor: null };

describe('lumaSource', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockedFetch.mockReset();
  });

  it('is enabled unless SOURCE_LUMA_ENABLED=false', () => {
    delete process.env.SOURCE_LUMA_ENABLED;
    expect(lumaSource.enabled()).toBe(true);
    process.env.SOURCE_LUMA_ENABLED = 'true';
    expect(lumaSource.enabled()).toBe(true);
    process.env.SOURCE_LUMA_ENABLED = 'false';
    expect(lumaSource.enabled()).toBe(false);
    delete process.env.SOURCE_LUMA_ENABLED;
  });

  it('normalizes entries and terminates pagination on has_more=false', async () => {
    mockedFetch
      .mockResolvedValueOnce(PAGE_ONE)
      .mockResolvedValueOnce(PAGE_TWO);

    const candidates = await lumaSource.fetchCandidates();

    // Two pages fetched: the second one because page one had has_more=true.
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(mockedFetch.mock.calls[0][0]);
    expect(firstUrl.pathname).toBe('/discover/get-paginated-events');
    expect(firstUrl.searchParams.get('discover_place_api_id')).toBe(
      'discplace-Izx1rQVSh8njYpP'
    );
    expect(firstUrl.searchParams.get('pagination_limit')).toBe('25');
    expect(firstUrl.searchParams.get('pagination_cursor')).toBeNull();

    const secondUrl = new URL(mockedFetch.mock.calls[1][0]);
    expect(secondUrl.searchParams.get('pagination_cursor')).toBe('cursor-page-2');

    // Invalid entry (no name) skipped: 2 + 1 = 3 normalized candidates.
    expect(candidates).toHaveLength(3);

    const obf = candidates.find((c) => c.sourceId === 'evt-obf-1');
    expect(obf).toMatchObject({
      source: 'luma',
      title: 'Rooftop Listening Session',
      sourceUrl: 'https://lu.ma/rooftop-listening',
      startsAt: '2026-09-12T22:00:00.000Z',
      endsAt: '2026-09-13T02:00:00.000Z',
      venueName: 'Brooklyn, NY, US',
      lat: 40.7191,
      lng: -73.9579,
      hype: { guestCount: 87, ticketCount: 30 },
      tags: ['ticket:paid'],
    });
    expect(obf?.raw).toBe(ENTRIES[0]);

    const free = candidates.find((c) => c.sourceId === 'evt-free-2');
    expect(free?.isFree).toBe(true);
    expect(free?.tags).toContain('isFree');
    expect(free?.hype).toEqual({ guestCount: 240, ticketCount: 45 });
    expect(candidates.some((c) => c.sourceId === 'evt-invalid-3')).toBe(false);
  });

  it('caps pagination at 6 pages', async () => {
    const endless = { entries: [ENTRIES[0]], has_more: true, next_cursor: 'c' };
    mockedFetch.mockImplementation(async () => endless);

    const candidates = await lumaSource.fetchCandidates();
    expect(mockedFetch).toHaveBeenCalledTimes(6);
    expect(candidates).toHaveLength(6);
  });

  it('honors SOURCE_LUMA_PLACE_ID override', async () => {
    process.env.SOURCE_LUMA_PLACE_ID = 'discplace-custom';
    mockedFetch.mockResolvedValueOnce(PAGE_TWO);

    await lumaSource.fetchCandidates();

    const url = new URL(mockedFetch.mock.calls[0][0]);
    expect(url.searchParams.get('discover_place_api_id')).toBe('discplace-custom');
  });
});
