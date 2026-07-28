import { describe, it, expect } from 'vitest';
import {
  isLateTheme,
  themeRhythm,
  effectiveRhythm,
  anchorBucket,
  isOnTheme,
  servesLateTheme,
  themeScore,
} from './theme';

/**
 * The theme as a structural input rather than prompt advice. Drawn from a real
 * run: a user asked for house music and got The Elevated Acre at 10:00,
 * Smorgasburg, Coney Island, and one club treated as an afterthought.
 */

describe('isLateTheme', () => {
  it('recognizes night-out themes', () => {
    for (const intent of [
      'house music',
      'techno clubs',
      'nightlife',
      'jazz bars',
      'cocktail spots',
      'live music and dancing',
    ]) {
      expect(isLateTheme(intent)).toBe(true);
    }
  });

  it('leaves daytime themes alone', () => {
    for (const intent of ['museums and galleries', 'street food', 'hiking', 'architecture']) {
      expect(isLateTheme(intent)).toBe(false);
    }
  });

  it('is empty-safe', () => {
    expect(isLateTheme(undefined)).toBe(false);
    expect(isLateTheme('   ')).toBe(false);
  });

  // Word boundaries: the marker list contains "bar".
  it('does not trip on words that merely contain a marker', () => {
    expect(isLateTheme('barcelona architecture')).toBe(false);
    expect(isLateTheme('clubhouse tours')).toBe(false);
  });
});

describe('effectiveRhythm', () => {
  // Profile is the floor, prompt is the steering wheel. Someone who asked for
  // house music this trip said something more specific, and more recent, than
  // a quiz answer they gave once.
  it('lets a late theme override even an early_bird profile', () => {
    expect(effectiveRhythm('early_bird', 'house music')).toBe('night_owl');
  });

  it('keeps the profile when the theme implies nothing', () => {
    expect(effectiveRhythm('early_bird', 'museums')).toBe('early_bird');
    expect(effectiveRhythm('early_bird', undefined)).toBe('early_bird');
  });

  it('falls back to a sane default with neither', () => {
    expect(effectiveRhythm(undefined, undefined)).toBe('steady_daytime');
  });

  it('reports the rhythm a theme implies', () => {
    expect(themeRhythm('techno')).toBe('night_owl');
    expect(themeRhythm('museums')).toBeNull();
  });
});

describe('anchorBucket', () => {
  it('anchors a night theme in the evening', () => {
    expect(anchorBucket('house music')).toBe('evening');
  });

  it('anchors everything else in the afternoon', () => {
    expect(anchorBucket('museums')).toBe('afternoon');
    expect(anchorBucket(undefined)).toBe('afternoon');
  });
});

describe('isOnTheme', () => {
  // The failure that started this: loose token counting scored "house" as a
  // full hit for a jazz museum.
  it('rejects a museum that merely contains the word "house"', () => {
    expect(isOnTheme('Louis Armstrong House Museum museum', 'house music')).toBe(false);
    expect(isOnTheme('The Merchant House Museum museum', 'house music')).toBe(false);
  });

  // The other side of the same coin: phrase matching alone also rejected the
  // one venue in the pool that genuinely is the thing asked for.
  it('accepts a real club recorded only as nightlife', () => {
    expect(
      isOnTheme(
        'House of Yes A vibrant nightlife venue in Bushwick known for themed parties nightlife',
        'house music'
      )
    ).toBe(true);
  });

  it('accepts a literal phrase match outright', () => {
    expect(isOnTheme('Nowadays deep house music sessions', 'house music')).toBe(true);
  });

  // The venue-kind bridge is scoped to late themes only — it must not make
  // every bar count toward a daytime theme.
  it('does not apply the nightlife bridge to a daytime theme', () => {
    expect(isOnTheme('A cocktail bar nightlife', 'museums and galleries')).toBe(false);
  });

  it('is false without a theme', () => {
    expect(isOnTheme('anything', undefined)).toBe(false);
  });
});

describe('servesLateTheme', () => {
  // Run against the real NYC pool, "live music"/"party"/"dance" matched
  // "Museum Mile Festival", which repair then moved to 21:00. Daytime things
  // describe themselves that way constantly; nothing calls itself a nightclub
  // by accident.
  it('does not treat a daytime festival as a night venue', () => {
    const festival =
      'Museum Mile Festival A street festival with live music, dancing and family activities event';
    expect(servesLateTheme(festival)).toBe(false);
    expect(isOnTheme(festival, 'house music')).toBe(false);
  });

  it('matches venue kinds rather than theme words', () => {
    expect(servesLateTheme('a nightclub in bushwick')).toBe(true);
    expect(servesLateTheme('speakeasy cocktail lounge')).toBe(true);
    expect(servesLateTheme('a quiet botanical garden')).toBe(false);
  });
});

describe('themeScore', () => {
  it('ranks a literal match above a venue-kind match', () => {
    const literal = themeScore('deep house music club', 'house music');
    const kindOnly = themeScore('a nightlife venue', 'house music');
    expect(literal).toBeGreaterThan(kindOnly);
  });

  it('is zero without a theme', () => {
    expect(themeScore('anything', undefined)).toBe(0);
  });
});

/**
 * The theme mechanism has to work for *any* prompt, not just nightlife.
 *
 * Measured across the five real pools, the first version found 1-8 anchors for
 * "house music" and "jazz bars" and exactly ZERO for "museums and galleries",
 * "vintage shopping", "ramen", "coffee shops" and "bookstores" — in pools that
 * contain the Frist Art Museum and The Cloisters. It was a nightlife special
 * case wearing a general name.
 */
describe('themes in general, not just nightlife', () => {
  it('matches a plural theme against a singular category', () => {
    // "museums" never substring-matched "Museum". This one mismatch produced
    // zero anchors for every museum theme in every pool.
    expect(isOnTheme('Frist Art Museum', 'museums and galleries', 'museum')).toBe(true);
    expect(isOnTheme('The Cloisters', 'museums and galleries', 'museum')).toBe(true);
  });

  it('works for daytime themes with no nightlife markers at all', () => {
    expect(isOnTheme('The Evolution Store', 'vintage shopping', 'shopping')).toBe(true);
    expect(isOnTheme('Strand', 'bookstores', 'bookstore')).toBe(true);
    expect(isOnTheme('Yoyogi Park', 'parks and gardens', 'park')).toBe(true);
  });

  it('treats a category hit as strong evidence and prose as weak', () => {
    const byCategory = themeScore('Some Place', 'museums and galleries', 'museum');
    const byProse = themeScore(
      'A cafe near the museum district',
      'museums and galleries',
      'cafe'
    );
    expect(byCategory).toBeGreaterThanOrEqual(1);
    expect(byProse).toBeLessThan(1);
  });

  // "shop" is inside "shopping" and means something else. Substring matching
  // on categories anchored a coffee theme on a taxidermy store.
  it('does not match a category by substring', () => {
    expect(isOnTheme('The Evolution Store', 'coffee shops', 'shopping')).toBe(false);
  });

  // The category signal must not resurrect the original false positive.
  it('still rejects the house museum for a house music theme', () => {
    expect(isOnTheme('Louis Armstrong House Museum', 'house music', 'museum')).toBe(false);
  });

  it('falls back to text when the candidate has no category', () => {
    expect(isOnTheme('Ajitama ramen bar', 'ramen', undefined)).toBe(true);
  });
});
