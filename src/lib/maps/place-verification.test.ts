import { describe, it, expect, afterEach } from 'vitest';
import {
  parseFindPlaceResponse,
  nameMatches,
  isPlaceVerificationEnabled,
  verifyAndFilter,
  type PlaceLookup,
  type VerifiableItem,
} from './place-verification';

/**
 * Places verification is the structural defense against hallucinated places.
 * These tests lock in the three pure pieces (response parsing, name matching,
 * the flag) and the filtering behavior — verified survivors enriched, the rest
 * dropped — using an injected lookup so no network or API key is needed.
 */

describe('parseFindPlaceResponse', () => {
  it('extracts the first candidate on OK', () => {
    const m = parseFindPlaceResponse({
      status: 'OK',
      candidates: [
        {
          place_id: 'abc',
          name: 'The Dead Rabbit',
          formatted_address: '30 Water St, New York, NY',
          geometry: { location: { lat: 40.7, lng: -74.0 } },
        },
      ],
    });
    expect(m).toEqual({
      found: true,
      name: 'The Dead Rabbit',
      address: '30 Water St, New York, NY',
      placeId: 'abc',
      location: { lat: 40.7, lng: -74.0 },
    });
  });

  it('treats ZERO_RESULTS as not found', () => {
    expect(parseFindPlaceResponse({ status: 'ZERO_RESULTS', candidates: [] })).toEqual({
      found: false,
    });
  });

  it('treats missing/garbage input as not found', () => {
    expect(parseFindPlaceResponse(null).found).toBe(false);
    expect(parseFindPlaceResponse({}).found).toBe(false);
    expect(parseFindPlaceResponse('nope').found).toBe(false);
  });

  it('omits location when geometry is absent', () => {
    const m = parseFindPlaceResponse({
      status: 'OK',
      candidates: [{ place_id: 'x', name: 'Somewhere', formatted_address: 'Addr' }],
    });
    expect(m.found).toBe(true);
    expect(m.location).toBeUndefined();
  });
});

describe('nameMatches', () => {
  it('matches ignoring punctuation, case, and filler words', () => {
    expect(nameMatches('The Dead Rabbit.', 'Dead Rabbit NYC')).toBe(true);
    expect(nameMatches('Katz’s Delicatessen', 'Katz Delicatessen')).toBe(true);
  });

  it('rejects an unrelated resolved place', () => {
    expect(nameMatches('Asdf Qwer Bar', 'Central Park')).toBe(false);
  });

  it('rejects when nothing meaningful is left after normalization', () => {
    expect(nameMatches('The Bar', 'A Restaurant')).toBe(false);
  });
});

describe('isPlaceVerificationEnabled', () => {
  const original = process.env.PLACES_VERIFICATION_ENABLED;
  afterEach(() => {
    process.env.PLACES_VERIFICATION_ENABLED = original;
  });

  it('is off by default', () => {
    delete process.env.PLACES_VERIFICATION_ENABLED;
    expect(isPlaceVerificationEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    process.env.PLACES_VERIFICATION_ENABLED = 'true';
    expect(isPlaceVerificationEnabled()).toBe(true);
    process.env.PLACES_VERIFICATION_ENABLED = '1';
    expect(isPlaceVerificationEnabled()).toBe(false);
  });
});

describe('verifyAndFilter', () => {
  const items: VerifiableItem[] = [
    { name: 'The Dead Rabbit' },
    { name: 'Totally Made Up Spot' },
    { name: 'Attaboy' },
  ];

  const lookup: PlaceLookup = async (query) => {
    if (query.startsWith('The Dead Rabbit'))
      return {
        found: true,
        name: 'The Dead Rabbit',
        address: '30 Water St',
        location: { lat: 40.7, lng: -74.0 },
      };
    if (query.startsWith('Attaboy'))
      return { found: true, name: 'Attaboy', address: '134 Eldridge St' };
    return { found: false };
  };

  it('passes items through untouched when disabled', async () => {
    const out = await verifyAndFilter(items, 'NYC', lookup, { enabled: false });
    expect(out).toEqual(items);
  });

  it('drops unverifiable candidates and enriches survivors', async () => {
    const out = await verifyAndFilter(items, 'NYC', lookup, { enabled: true });
    expect(out.map((i) => i.name)).toEqual(['The Dead Rabbit', 'Attaboy']);
    expect(out[0].address).toBe('30 Water St');
    expect(out[0].coordinates).toEqual({ lat: 40.7, lng: -74.0 });
  });

  it('drops a candidate whose resolved name does not match', async () => {
    const wrongMatch: PlaceLookup = async () => ({
      found: true,
      name: 'Some Other Place Entirely',
      address: 'Elsewhere',
    });
    const out = await verifyAndFilter([{ name: 'Joe Bar' }], 'NYC', wrongMatch, {
      enabled: true,
    });
    expect(out).toEqual([]);
  });

  it('drops the item but does not throw when lookup errors', async () => {
    const throwingLookup: PlaceLookup = async () => {
      throw new Error('network down');
    };
    const out = await verifyAndFilter([{ name: 'Anywhere' }], 'NYC', throwingLookup, {
      enabled: true,
    });
    expect(out).toEqual([]);
  });

  it('returns [] input unchanged (no lookup calls) for empty list', async () => {
    let called = 0;
    const counting: PlaceLookup = async () => {
      called++;
      return { found: false };
    };
    const out = await verifyAndFilter([], 'NYC', counting, { enabled: true });
    expect(out).toEqual([]);
    expect(called).toBe(0);
  });
});
