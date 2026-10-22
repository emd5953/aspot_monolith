import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  candidateToRow,
  dedupeRows,
  normalizeDedupeKey,
  getTonightPool,
  isRecommendable,
  upsertCandidates,
  type PoolCandidateRow,
} from './pool-service';
import { EventDetailsSchema, RawCandidateSchema, isInNyc } from './types';

const now = new Date('2026-10-23T02:00:00Z'); // Thursday 10pm NYC
const from = new Date('2026-10-22T04:00:00Z'),
  to = new Date('2026-10-23T10:00:00Z');
const row = (over: Partial<PoolCandidateRow> = {}): PoolCandidateRow => ({
  id: '1',
  source: 'posh',
  source_id: 'one',
  source_url: 'https://posh.vip/e/one',
  title: 'R&B Night',
  description: null,
  starts_at: '2026-10-23T03:00:00Z',
  ends_at: '2026-10-23T08:00:00Z',
  venue_name: 'Club One',
  address: '1 Main St, Brooklyn',
  lat: null,
  lng: null,
  price_min: null,
  price_max: null,
  is_free: null,
  hype: {},
  tags: [],
  fetched_at: now.toISOString(),
  expires_at: null,
  details: EventDetailsSchema.parse({}),
  ...over,
});

describe('event identity', () => {
  it('uses NYC date across offsets, unicode, and the full title', () => {
    expect(normalizeDedupeKey('Café R&B!', '2026-10-23T02:00:00Z')).toBe(
      normalizeDedupeKey('Cafe R and B', '2026-10-22T22:00:00-04:00')
    );
    expect(normalizeDedupeKey('a'.repeat(40) + ' one')).not.toBe(
      normalizeDedupeKey('a'.repeat(40) + ' two')
    );
    expect(normalizeDedupeKey('根津')).not.toBe(normalizeDedupeKey('東京'));
  });
  it('retains separate venues, unknown venues, sessions, and nights', () => {
    expect(
      dedupeRows([
        row(),
        row({
          source: 'luma',
          source_url: 'https://lu.ma/two',
          venue_name: 'Other Club',
          address: '2 Main St',
        }),
      ])
    ).toHaveLength(2);
    expect(
      dedupeRows([
        row({ venue_name: null, address: null }),
        row({ source: 'luma', source_url: 'https://lu.ma/two', venue_name: null, address: null }),
      ])
    ).toHaveLength(2);
    expect(
      dedupeRows([
        row(),
        row({
          source_id: 'two',
          source_url: 'https://posh.vip/e/two',
          starts_at: '2026-10-23T03:30:00Z',
        }),
      ])
    ).toHaveLength(2);
    expect(
      dedupeRows([
        row(),
        row({ source: 'luma', source_url: 'https://lu.ma/two', starts_at: '2026-10-24T03:00:00Z' }),
      ])
    ).toHaveLength(2);
  });
  it('merges cross listings, retains links and conflicts, uses freshest observation', () => {
    const rows = [
      row(),
      row({
        source: 'partiful',
        source_url: 'https://partiful.com/e/two',
        fetched_at: '2026-10-23T01:00:00Z',
        starts_at: '2026-10-23T03:30:00Z',
      }),
    ];
    const result = dedupeRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('posh');
    expect(result[0].listings).toHaveLength(2);
    expect(result[0].conflicts?.join(' ')).toContain('start');
    expect(dedupeRows(rows.slice().reverse())).toEqual(result);
    expect(dedupeRows(result)).toEqual(result);
  });
  it('does not call different timestamp offsets a conflict', () => {
    const result = dedupeRows([
      row(),
      row({
        source: 'luma',
        source_url: 'https://lu.ma/one',
        starts_at: '2026-10-22T23:00:00-04:00',
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].conflicts).toEqual([]);
  });
  it('preserves a fresh cancellation/sellout across listings', () => {
    const result = dedupeRows([
      row(),
      row({
        source: 'partiful',
        source_url: 'https://partiful.com/e/two',
        details: EventDetailsSchema.parse({ status: 'cancelled', availability: 'sold_out' }),
      }),
    ]);
    expect(result[0].details).toMatchObject({ status: 'cancelled', availability: 'sold_out' });
    expect(isRecommendable(result[0], from, to, now)).toBe(false);
  });
});

describe('eligibility is read-time, independent of cron cleanup', () => {
  it.each([
    { starts_at: null },
    { fetched_at: '2026-10-21T00:00:00Z' },
    { fetched_at: 'bad' },
    { fetched_at: '2026-10-24T00:00:00Z' },
    { expires_at: '2026-10-22T00:00:00Z' },
    { starts_at: '2026-10-23T01:00:00Z', ends_at: null },
    { starts_at: '2026-10-23T01:00:00Z', ends_at: '2026-10-23T01:30:00Z' },
    { starts_at: '2026-10-23T10:00:00Z', ends_at: null },
    { starts_at: '2026-10-22T03:59:59Z', ends_at: '2026-10-25T08:00:00Z' },
    { details: EventDetailsSchema.parse({ status: 'postponed' }) },
    { details: EventDetailsSchema.parse({ availability: 'sold_out' }) },
  ])('excludes unusable listing %j', (over) =>
    expect(isRecommendable(row(over), from, to, now)).toBe(false)
  );
  it('includes a known ongoing event and future after-midnight events', () => {
    expect(isRecommendable(row({ starts_at: '2026-10-23T01:00:00Z' }), from, to, now)).toBe(true);
    expect(isRecommendable(row({ starts_at: '2026-10-23T05:00:00Z' }), from, to, now)).toBe(true);
  });
  it('queries the overnight window with a freshness cutoff, then applies exclusions', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          row(),
          row({
            id: 'bad',
            source_id: 'bad',
            source_url: 'https://posh.vip/e/bad',
            details: EventDetailsSchema.parse({ status: 'cancelled' }),
          }),
        ],
        error: null,
      }),
    };
    const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    const result = await getTonightPool(client, { now: new Date('2026-10-23T04:30:00Z') });
    expect(builder.lt).toHaveBeenCalledWith('starts_at', '2026-10-23T10:00:00.000Z');
    expect(builder.gte).toHaveBeenCalledWith('starts_at', '2026-10-22T04:00:00.000Z');
    expect(builder.gte).toHaveBeenCalledWith('fetched_at', '2026-10-22T04:30:00.000Z');
    expect(result.map((r) => r.id)).toEqual(['1']);
  });
});

describe('persistence boundary', () => {
  it('keeps unknown prices nullable and upserts each source/id only once', async () => {
    const c = RawCandidateSchema.parse({ source: 'posh', sourceId: '1', title: 'one', raw: {} });
    expect(candidateToRow(c, now).is_free).toBeNull();
    const upsert = vi.fn().mockResolvedValue({ count: 1, error: null });
    await upsertCandidates({ from: () => ({ upsert }) } as unknown as SupabaseClient, [
      c,
      { ...c, title: 'updated' },
    ]);
    expect(upsert.mock.calls[0][0]).toHaveLength(1);
    expect(upsert.mock.calls[0][0][0].title).toBe('updated');
  });
  it('filters known non-NYC coordinates without losing unlocated events', () => {
    expect(isInNyc(40.7, -73.9)).toBe(true);
    expect(isInNyc(34, -118)).toBe(false);
    expect(isInNyc()).toBe(true);
  });
});
