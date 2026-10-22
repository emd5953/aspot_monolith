import { describe, it, expect, vi } from 'vitest';
import { parseConversation, recommendFromPool, runDiscoveryConversation } from './conversation';
import { candidateToRow, type PoolCandidateRow } from '@/lib/sources/pool-service';
import { normalizePoshStructuredEvent } from '@/lib/sources/structured-event';
import { normalizeEvent } from '@/lib/sources/posh';
import { EventDetailsSchema } from '@/lib/sources/types';
import { DiscoveryRequestSchema } from '@/lib/ai/schemas/discovery';
import rnb from '@/lib/sources/__fixtures__/posh-rnb-live.json';
import posh from '@/lib/sources/__fixtures__/posh-live.json';
import longRange from '@/lib/sources/__fixtures__/posh-long-range-live.json';

const now = new Date('2026-10-22T23:00:00Z'); // fixed replay clock, 7pm ET
const request = (...texts: string[]) =>
  DiscoveryRequestSchema.parse({ messages: texts.map((content) => ({ role: 'user', content })) });
const real = (): PoolCandidateRow => ({
  id: 'real',
  ...candidateToRow(normalizePoshStructuredEvent(rnb.event)!, now),
});
const intent = () =>
  parseConversation(request("What's the move for R&B tonight in NYC?"), now).intent;

describe('source-backed recommendation replay', () => {
  it('does not treat a fresh multi-week listing as an occurrence on the requested night', async () => {
    const range = { id: 'range', ...candidateToRow(normalizeEvent(longRange.event)!, now) };
    const result = await runDiscoveryConversation(request('R&B tonight'), {
      now,
      readPool: async () => [range, real()],
    });
    expect(range.starts_at).toBe('2026-10-02T05:15:00.000Z');
    expect(range.ends_at).toBe('2026-10-25T08:00:00.000Z');
    expect(result.recommendations.map((event) => event.id)).toEqual(['real']);
    expect(result.reply).not.toContain(longRange.event.title);
  });
  it('recommends the real listing with published times, source, price and evidence', async () => {
    const past = { id: 'past', ...candidateToRow(normalizeEvent(posh.events[1])!, now) };
    const result = await runDiscoveryConversation(
      request("What's the move for R&B tonight in NYC?"),
      { now, readPool: async () => [real(), past] }
    );
    expect(result.status).toBe('recommendations');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      title: rnb.event.name,
      startsAt: '2026-10-23T00:00:00.000Z',
      endsAt: '2026-10-23T04:15:00.000Z',
      availability: 'available',
    });
    expect(result.reply).toContain('8:00 PM EDT');
    expect(result.reply).toContain('Negril Village');
    expect(result.reply).toContain(rnb.event.url);
    expect(result.reply).toContain('From $0');
    expect(result.reply).not.toContain('Listed as free');
    expect(result.recommendations[0].reasons[0]).toContain('Listing mentions R&B');
  });
  it('does not recommend unknown, stale, cancelled, postponed or sold-out listings', () => {
    const variants = [
      { starts_at: null },
      { fetched_at: '2026-10-20T23:00:00Z' },
      { details: EventDetailsSchema.parse({ status: 'cancelled' }) },
      { details: EventDetailsSchema.parse({ status: 'postponed' }) },
      { details: EventDetailsSchema.parse({ availability: 'sold_out' }) },
    ];
    for (const over of variants)
      expect(recommendFromPool([{ ...real(), ...over }], intent(), now)).toEqual([]);
  });
  it('does not let a stale cancellation veto a fresh listing', () => {
    const stale = {
      ...real(),
      source: 'luma',
      source_url: 'https://lu.ma/copy',
      fetched_at: '2026-10-20T23:00:00Z',
      details: EventDetailsSchema.parse({ status: 'cancelled' }),
    };
    expect(recommendFromPool([stale, real()], intent(), now)).toHaveLength(1);
  });
  it('labels unknown availability, price and location instead of guessing', () => {
    const item = real();
    const result = recommendFromPool(
      [
        {
          ...item,
          price_min: null,
          price_max: null,
          venue_name: null,
          address: null,
          details: { ...item.details!, availability: 'unknown' },
        },
      ],
      intent(),
      now
    )[0];
    expect(result).toMatchObject({
      price: 'Price not listed',
      location: 'Location not announced',
      availability: 'unknown',
    });
    expect(result.caveats.join(' ')).toContain('unconfirmed');
  });
  it('does not claim a lower starting price guarantees admission within budget', () => {
    const result = recommendFromPool([real()], { ...intent(), maxPrice: 20 }, now);
    expect(result[0].caveats.join(' ')).toContain('ticket tiers and fees');
    expect(recommendFromPool([real()], { ...intent(), freeOnly: true }, now)).toEqual([]);
    const unknownPrice = { ...real(), price_min: null, price_max: null };
    expect(recommendFromPool([unknownPrice], { ...intent(), maxPrice: 20 }, now)).toEqual([]);
  });
  it('does not fabricate fallback matches when the pool has none', async () => {
    const result = await runDiscoveryConversation(request('R&B tonight'), {
      now,
      readPool: async () => [],
    });
    expect(result.status).toBe('no_matches');
    expect(result.reply).toContain('does not mean nothing');
    expect(result.recommendations).toEqual([]);
  });
});

describe('multi-turn intent and NYC nights', () => {
  it('accepts documented constraint resets and no-cover follow-ups', () => {
    for (const text of ['any price', 'anywhere', 'any genre', 'no cover', 'meet people']) {
      expect(parseConversation(request('R&B tonight', text), now).clarification).toBeUndefined();
    }
    expect(
      parseConversation(request('R&B tonight under $20', 'any price'), now).intent.maxPrice
    ).toBeUndefined();
  });
  it('keeps an unanswered date/music clarification pending across unrelated preferences', () => {
    expect(parseConversation(request('R&B this weekend', 'Brooklyn'), now).clarification).toContain(
      'Which night'
    );
    expect(
      parseConversation(request('R&B this weekend', '2026-10-23'), now).clarification
    ).toBeUndefined();
    expect(parseConversation(request('no jazz', 'Brooklyn'), now).clarification).toContain(
      'Which music'
    );
    expect(parseConversation(request('no jazz', 'R&B tonight'), now).intent.genres).toEqual([
      'rnb',
    ]);
  });
  it('clarifies a vague prompt without querying the database', async () => {
    const readPool = vi.fn();
    expect(
      (await runDiscoveryConversation(request("What's the move?"), { now, readPool })).status
    ).toBe('clarification');
    expect(readPool).not.toHaveBeenCalled();
  });
  it('carries and replaces explicit preferences, ignoring assistant claims', () => {
    const input = request('R&B tonight', 'Brooklyn under $30', 'actually jazz tomorrow');
    input.messages.splice(1, 0, { role: 'assistant', content: 'Free tickets in Queens at 5pm' });
    expect(parseConversation(input, now)).toMatchObject({
      intent: {
        genres: ['jazz'],
        area: 'brooklyn',
        maxPrice: 30,
        freeOnly: false,
        date: '2026-10-23',
      },
    });
    expect(parseConversation(input, now).clarification).toBeUndefined();
  });
  it('rejects invalid dates and asks for ambiguous timing/unsupported preferences', () => {
    for (const text of [
      'R&B 2026-02-30',
      'R&B this weekend',
      'R&B after midnight',
      'R&B tonight',
      'no jazz',
    ]) {
      const result = parseConversation(request(text), now);
      if (text === 'R&B tonight') expect(result.clarification).toBeUndefined();
      else expect(result.clarification).toBeTruthy();
    }
    expect(
      parseConversation(request('R&B tonight', 'make it cozy'), now).clarification
    ).toBeTruthy();
  });
  it('anchors 1am tonight to the previous evening and includes only its remaining hours', () => {
    const late = new Date('2026-10-23T05:00:00Z');
    const state = parseConversation(request('R&B tonight'), late).intent;
    expect(state.date).toBe('2026-10-22');
    const item = {
      ...real(),
      starts_at: '2026-10-23T05:30:00Z',
      ends_at: '2026-10-23T08:00:00Z',
      expires_at: null,
    };
    const result = recommendFromPool([item], state, late);
    expect(result).toHaveLength(1);
    expect(result[0].when).toContain('Fri, Oct 23');
    expect(result[0].when).toContain('1:30 AM EDT');
    expect(
      recommendFromPool(
        [{ ...item, starts_at: '2026-10-24T02:00:00Z', ends_at: null }],
        state,
        late
      )
    ).toEqual([]);
  });
  it('includes both repeated 1:30am instants on the fall DST night with their offsets', () => {
    const clock = new Date('2026-11-01T04:00:00Z');
    const state = parseConversation(request('R&B tonight'), clock).intent;
    expect(state.date).toBe('2026-10-31');
    const rows = ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'].map((starts_at, i) => ({
      ...real(),
      id: String(i),
      source_id: String(i),
      source_url: `https://posh.vip/e/dst-${i}`,
      starts_at,
      ends_at: '2026-11-01T09:00:00Z',
      expires_at: null,
      fetched_at: clock.toISOString(),
    }));
    const result = recommendFromPool(rows, state, clock);
    expect(result).toHaveLength(2);
    expect(result[0].when).toContain('EDT');
    expect(result[1].when).toContain('EST');
  });
});
