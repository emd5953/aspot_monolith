import { describe, it, expect, vi } from 'vitest';
import { normalizeEvent, poshSource } from './posh';
import { normalizeLumaEntry } from './luma';
import { normalizePartifulEvent, partifulSource } from './partiful';
import { extractStructuredEvents, normalizePoshStructuredEvent } from './structured-event';
import { sourceTime, eventDetails } from './normalize';
import { tiktokSource } from './tiktok';
import { politeFetchJson, politeFetchText } from './polite-fetch';
import posh from './__fixtures__/posh-live.json';
import luma from './__fixtures__/luma-live.json';
import paidLuma from './__fixtures__/luma-paid-live.json';
import partiful from './__fixtures__/partiful-live.json';
import rnb from './__fixtures__/posh-rnb-live.json';

vi.mock('./polite-fetch', () => ({ politeFetchJson: vi.fn(), politeFetchText: vi.fn() }));

describe('public listings captured 2026-10-22 (no network)', () => {
  it('enriches a discovered URL with the matching page while keeping source identity and both payloads', async () => {
    // Synthetic discovery seed; the detail payload is the captured public listing.
    const seed = { id: 'seed-id', title: rnb.event.name, url: rnb.event.url };
    vi.mocked(politeFetchJson).mockResolvedValueOnce({ events: [seed], nextCursor: null });
    vi.mocked(politeFetchText).mockResolvedValueOnce(
      `<script type="application/ld+json">${JSON.stringify(rnb.event)}</script>`
    );
    vi.stubEnv('SOURCE_POSH_DETAILS_ENABLED', 'true');
    try {
      const result = await poshSource.fetchCandidates();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        sourceId: 'seed-id',
        startsAt: '2026-10-23T00:00:00.000Z',
        details: { currency: 'USD' },
        raw: { discovery: seed, detail: rnb.event },
      });
    } finally {
      vi.unstubAllEnvs();
      vi.mocked(politeFetchJson).mockReset();
      vi.mocked(politeFetchText).mockReset();
    }
  });
  it('extracts the real Posh BFF aliases, including price zero without declaring free', () => {
    const result = normalizeEvent(posh.events[0]);
    expect(result).toMatchObject({
      title: 'Laila! Presents CLUB GENIUS',
      startsAt: '2026-10-23T01:00:00.000Z',
      endsAt: '2026-10-23T06:00:00.000Z',
      venueName: '525 Waverly Ave',
      priceMin: 0,
      sourceUrl: 'https://posh.vip/e/laila-presents-club-genius',
    });
    expect(result?.isFree).toBeUndefined();
    expect(result?.details?.availability).toBe('unknown');
    expect(result?.raw).toBe(posh.events[0]);
  });
  it('reads nested Luma location and ticket state without exposing guests-only coordinates', () => {
    const result = normalizeLumaEntry(luma.entry);
    expect(result).toMatchObject({
      sourceId: 'evt-1MFDTkuNlNm1pHw',
      isFree: true,
      details: {
        neighborhood: 'Garment District, New York, NY',
        locationVisibility: 'approximate',
        availability: 'approval_required',
      },
    });
    expect(result?.venueName).toBeUndefined();
    expect(result?.lat).toBeUndefined();
    expect(result?.address).toBeUndefined();
  });
  it('converts the verified Luma USD cents shape and carries a public venue id', () => {
    expect(normalizeLumaEntry(paidLuma.entry)).toMatchObject({
      priceMin: 10,
      isFree: false,
      details: { currency: 'USD', venueId: 'google:ChIJrymeHJVZwokRVFgYEYKlB0Q' },
    });
  });
  it('extracts Partiful displayName/displayAddressLines and does not invent a ticket price', () => {
    const result = normalizePartifulEvent(partiful.event.id, partiful.event);
    expect(result).toMatchObject({
      venueName: 'ACE HOTEL',
      address: '20 W 29th St, New York, NY',
      startsAt: '2026-11-01T02:00:00.000Z',
      endsAt: '2026-11-01T09:00:00.000Z',
      details: { status: 'scheduled' },
    });
    expect(result?.priceMin).toBeUndefined();
  });
  it('reads Posh page JSON-LD from either a normal script or a Next string transport', () => {
    const standard = `<script type="application/ld+json">${JSON.stringify(rnb.event)}</script>`;
    const streamed = `<script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(rnb.event)])})</script>`;
    for (const html of [standard, streamed]) {
      const events = extractStructuredEvents(html);
      expect(events).toHaveLength(1);
      const result = normalizePoshStructuredEvent(events[0]);
      expect(result).toMatchObject({
        venueName: 'Negril Village',
        startsAt: '2026-10-23T00:00:00.000Z',
        endsAt: '2026-10-23T04:15:00.000Z',
        priceMin: 0,
        details: { currency: 'USD', availability: 'available', status: 'scheduled' },
      });
      expect(result?.details?.music.map((m) => m.genre)).toContain('rnb');
    }
  });
});

describe('synthetic failure and uncertainty cases', () => {
  it('does not parse timezone-less or impossible times using the machine timezone', () => {
    expect(sourceTime('2026-10-22T20:00:00')).toBeUndefined();
    expect(sourceTime('tonight')).toBeUndefined();
    expect(sourceTime('2026-02-30T20:00:00Z')).toBeUndefined();
    expect(sourceTime('2026-10-22 20:00:00Z')).toBe('2026-10-22T20:00:00.000Z');
    const result = normalizeEvent({ id: 'a', title: 'A', startDate: '2026-10-22T20:00:00' });
    expect(result?.startsAt).toBeUndefined();
    expect(result?.details?.issues).toHaveLength(1);
  });
  it('keeps an event with a conflicting end but drops the invalid end fact', () => {
    const result = normalizeEvent({
      id: 'a',
      title: 'A',
      startDate: '2026-10-22T20:00:00Z',
      endDate: '2026-10-22T19:00:00Z',
    });
    expect(result?.endsAt).toBeUndefined();
    expect(result?.details?.issues[0]).toContain('end precedes');
  });
  it('retains cancellation and sold-out signals, treats missing status as unknown', () => {
    expect(
      normalizeEvent({ id: 'a', title: 'A', isCancelled: true, isSoldOut: true })?.details
    ).toMatchObject({ status: 'cancelled', availability: 'sold_out' });
    expect(normalizeLumaEntry(null)).toBeNull();
    expect(
      normalizeLumaEntry({ api_id: 'a', name: 'A', waitlist_enabled: true })?.details?.availability
    ).toBe('unknown');
    expect(normalizePartifulEvent('a', { title: 'A', status: 'CANCELLED' })?.details?.status).toBe(
      'cancelled'
    );
  });
  it('requires literal music evidence rather than a venue-name guess', () => {
    expect(eventDetails({ title: 'House of Yes' }).music).toEqual([]);
    expect(eventDetails({ title: 'No R&B tonight' }).music).toEqual([]);
    expect(eventDetails({ title: 'Jazz listening party' }).categories).not.toContain('live_music');
    expect(eventDetails({ title: 'R&B and deep house party' }).music.map((m) => m.genre)).toEqual([
      'rnb',
      'house',
    ]);
  });
  it('rejects executable/foreign links', () => {
    expect(
      normalizeEvent({ id: 'x', title: 'X', url: 'https://evil.example/e/x' })?.sourceUrl
    ).toBeUndefined();
    expect(
      normalizeLumaEntry({ api_id: 'x', name: 'X', url: 'javascript:alert(1)' })?.sourceUrl
    ).toBeUndefined();
  });
  it('honors the Partiful gate inside the connector and surfaces total hydration failure', async () => {
    vi.stubEnv('SOURCE_PARTIFUL_ENABLED', 'false');
    expect(await partifulSource.fetchCandidates()).toEqual([]);
    expect(politeFetchText).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.mocked(politeFetchText).mockResolvedValue(
      `<script id="__NEXT_DATA__">${JSON.stringify({ buildId: 'x', props: { pageProps: { trendingSections: { NYC: { items: [{ id: 'a' }] } } } } })}</script>`
    );
    vi.mocked(politeFetchJson).mockRejectedValue(new Error('403'));
    await expect(partifulSource.fetchCandidates()).rejects.toThrow('no usable events');
  });
  it('does not report an enabled TikTok stub as a successful empty feed', async () => {
    vi.stubEnv('SOURCE_TIKTOK_ENABLED', 'true');
    await expect(tiktokSource.fetchCandidates()).rejects.toThrow('not implemented');
    vi.unstubAllEnvs();
  });
});
