import { describe, it, expect, afterEach } from 'vitest';
import {
  parseFindPlaceResponse,
  nameMatches,
  isPlaceVerificationEnabled,
  parseOpeningHours,
  isOpenAt,
  verifyAndFilter,
  type PlaceLookup,
  type VerifiableItem,
  type HoursLookup,
  type WeeklyHours,
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
  const originalFlag = process.env.PLACES_VERIFICATION_ENABLED;
  const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  afterEach(() => {
    process.env.PLACES_VERIFICATION_ENABLED = originalFlag;
    process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.PLACES_VERIFICATION_ENABLED;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
  });

  // The default is keyed off the API key rather than an opt-in flag. An unset
  // opt-in flag silently disabled geo-clustering and the geographic audit
  // checks, and nothing surfaced that they were dark.
  it('is on by default when a server-side Google key is configured', () => {
    delete process.env.PLACES_VERIFICATION_ENABLED;
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    expect(isPlaceVerificationEnabled()).toBe(true);
  });

  it('is off without a key, so the pipeline still runs unconfigured', () => {
    delete process.env.PLACES_VERIFICATION_ENABLED;
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    expect(isPlaceVerificationEnabled()).toBe(false);
  });

  it('honors an explicit "false" even with a key present', () => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    process.env.PLACES_VERIFICATION_ENABLED = 'false';
    expect(isPlaceVerificationEnabled()).toBe(false);
  });

  it('honors an explicit "true" even without a key', () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    process.env.PLACES_VERIFICATION_ENABLED = 'true';
    expect(isPlaceVerificationEnabled()).toBe(true);
  });
});

describe('parseOpeningHours', () => {
  it('parses a normal weekday window into minutes', () => {
    const hours = parseOpeningHours({
      opening_hours: {
        periods: [{ open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } }],
      },
    });
    expect(hours).toEqual([{ day: 1, open: 540, close: 1020 }]);
  });

  it('expands the always-open sentinel to all seven days', () => {
    const hours = parseOpeningHours({
      opening_hours: { periods: [{ open: { day: 0, time: '0000' } }] },
    });
    expect(hours).toHaveLength(7);
    expect(hours?.every((p) => p.open === 0 && p.close === 1440)).toBe(true);
  });

  it('extends a past-midnight close instead of splitting it', () => {
    const hours = parseOpeningHours({
      opening_hours: {
        periods: [{ open: { day: 5, time: '2000' }, close: { day: 6, time: '0200' } }],
      },
    });
    expect(hours).toEqual([{ day: 5, open: 1200, close: 1560 }]);
  });

  it('treats a missing close as open through end of day', () => {
    const hours = parseOpeningHours({
      opening_hours: { periods: [{ open: { day: 3, time: '1000' } }] },
    });
    expect(hours).toEqual([{ day: 3, open: 600, close: 1440 }]);
  });

  it('skips unparseable periods rather than throwing', () => {
    const hours = parseOpeningHours({
      opening_hours: {
        periods: [
          { open: { day: 9, time: '0900' }, close: { day: 9, time: '1700' } },
          { open: { day: 2, time: 'nope' } },
          { open: { day: 4, time: '0800' }, close: { day: 4, time: '1200' } },
        ],
      },
    });
    expect(hours).toEqual([{ day: 4, open: 480, close: 720 }]);
  });

  it('returns null when there is no usable data', () => {
    expect(parseOpeningHours(null)).toBeNull();
    expect(parseOpeningHours({})).toBeNull();
    expect(parseOpeningHours({ opening_hours: { periods: [] } })).toBeNull();
    expect(parseOpeningHours({ opening_hours: { periods: [{ open: {} }] } })).toBeNull();
  });
});

describe('isOpenAt', () => {
  const weekdays: WeeklyHours = [{ day: 1, open: 540, close: 1020 }];

  it('is open inside the window and shut outside it', () => {
    expect(isOpenAt(weekdays, 1, 600)).toBe(true);
    expect(isOpenAt(weekdays, 1, 480)).toBe(false);
    expect(isOpenAt(weekdays, 1, 1100)).toBe(false);
  });

  it('is shut on a day with no window at all', () => {
    expect(isOpenAt(weekdays, 2, 600)).toBe(false);
  });

  it('treats close as exclusive and open as inclusive', () => {
    expect(isOpenAt(weekdays, 1, 540)).toBe(true);
    expect(isOpenAt(weekdays, 1, 1020)).toBe(false);
  });

  it('resolves an after-midnight time against the previous day\'s session', () => {
    const friNight: WeeklyHours = [{ day: 5, open: 1200, close: 1560 }];
    // 01:00 Saturday falls inside Friday's 20:00–02:00 window.
    expect(isOpenAt(friNight, 6, 60)).toBe(true);
    // 03:00 Saturday is after it closed.
    expect(isOpenAt(friNight, 6, 180)).toBe(false);
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

  it('enriches what it resolves and keeps what it cannot', async () => {
    // Enrich, don't drop. Measured against the real research cache, the
    // unresolvable ~10-25% is overwhelmingly dated events and walking tours
    // that correctly have no Places entry; dropping them silently deleted the
    // entire events feature from every itinerary.
    const out = await verifyAndFilter(items, 'NYC', lookup, { enabled: true });
    expect(out.map((i) => i.name)).toEqual([
      'The Dead Rabbit',
      'Totally Made Up Spot',
      'Attaboy',
    ]);
    expect(out[0].address).toBe('30 Water St');
    expect(out[0].coordinates).toEqual({ lat: 40.7, lng: -74.0 });
    // Unresolved survives, just unlocated — so geo-clustering skips it.
    expect(out[1].coordinates).toBeUndefined();
  });

  it('keeps a candidate whose resolved name does not match, unenriched', async () => {
    const wrongMatch: PlaceLookup = async () => ({
      found: true,
      name: 'Some Other Place Entirely',
      address: 'Elsewhere',
      location: { lat: 1, lng: 2 },
    });
    const out = await verifyAndFilter([{ name: 'Joe Bar' }], 'NYC', wrongMatch, {
      enabled: true,
    });
    expect(out).toEqual([{ name: 'Joe Bar' }]);
  });

  it('keeps the item and does not throw when lookup errors', async () => {
    const throwingLookup: PlaceLookup = async () => {
      throw new Error('network down');
    };
    const out = await verifyAndFilter([{ name: 'Anywhere' }], 'NYC', throwingLookup, {
      enabled: true,
    });
    expect(out).toEqual([{ name: 'Anywhere' }]);
  });

  it('still filters when explicitly asked to drop', async () => {
    const out = await verifyAndFilter(items, 'NYC', lookup, {
      enabled: true,
      drop: true,
    });
    expect(out.map((i) => i.name)).toEqual(['The Dead Rabbit', 'Attaboy']);
  });

  // The hours hop is keyed on place_id, so it only fires for a resolution that
  // returned one — `lookup` above deliberately does not.
  const idLookup: PlaceLookup = async () => ({
    found: true,
    name: 'The Dead Rabbit',
    address: '30 Water St',
    placeId: 'place-123',
    location: { lat: 40.7, lng: -74.0 },
  });

  it('stamps opening hours when the hours lookup is supplied', async () => {
    const hours: HoursLookup = async () => [{ day: 1, open: 540, close: 1020 }];
    const out = await verifyAndFilter([{ name: 'The Dead Rabbit' } as VerifiableItem], 'NYC', idLookup, {
      enabled: true,
      hours,
    });
    expect(out[0].openingHours).toEqual([{ day: 1, open: 540, close: 1020 }]);
  });

  it('passes the resolved place id to the hours lookup', async () => {
    const seen: string[] = [];
    const hours: HoursLookup = async (id) => {
      seen.push(id);
      return null;
    };
    await verifyAndFilter([{ name: 'The Dead Rabbit' } as VerifiableItem], 'NYC', idLookup, {
      enabled: true,
      hours,
    });
    expect(seen).toEqual(['place-123']);
  });

  it('does not call the hours lookup when the match carries no place id', async () => {
    let called = 0;
    const hours: HoursLookup = async () => {
      called++;
      return null;
    };
    await verifyAndFilter([{ name: 'The Dead Rabbit' } as VerifiableItem], 'NYC', lookup, {
      enabled: true,
      hours,
    });
    expect(called).toBe(0);
  });

  it('skips the hours hop entirely when none is supplied', async () => {
    const out = await verifyAndFilter([{ name: 'The Dead Rabbit' } as VerifiableItem], 'NYC', idLookup, {
      enabled: true,
    });
    expect(out[0].openingHours).toBeUndefined();
  });

  // An outage must not cost us the coordinates the first call just earned —
  // those gate geo-clustering, which is the more valuable of the two signals.
  it('keeps the verified item when the hours lookup throws', async () => {
    const throwingHours: HoursLookup = async () => {
      throw new Error('details down');
    };
    const out = await verifyAndFilter([{ name: 'The Dead Rabbit' } as VerifiableItem], 'NYC', idLookup, {
      enabled: true,
      hours: throwingHours,
    });
    expect(out).toHaveLength(1);
    expect(out[0].coordinates).toBeDefined();
    expect(out[0].openingHours).toBeUndefined();
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
