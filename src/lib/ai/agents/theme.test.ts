import { describe, it, expect } from 'vitest';
import {
  isLateTheme,
  themeRhythm,
  effectiveRhythm,
  anchorBucket,
  isAnchor,
  servesTheme,
  themeWeight,
  poolWasThemeTagged,
} from './theme';

/**
 * What survives here is the structural half of a theme: rhythm and anchor slot.
 *
 * Deciding whether a given venue serves a theme used to live here too, as text
 * matching, and it was the wrong tool — a matcher can only see that House of
 * Yes and the Louis Armstrong House Museum both contain "house". Measured
 * across five real pools it found anchors for nightlife themes and zero for
 * museums, vintage shopping, ramen, coffee and bookshops. That judgement now
 * happens at extraction, where a model is reading the source page.
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
    for (const intent of ['museums and galleries', 'street food', 'hiking', 'bookstores']) {
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

  // This list reads the user's own phrasing, never a venue's description —
  // which is why it survived the deletion of the rest of the matching.
  it('reads the prompt, not a place', () => {
    expect(isLateTheme('house')).toBe(true);
  });
});

describe('effectiveRhythm', () => {
  // Profile is the floor, prompt is the steering wheel.
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
    expect(anchorBucket('vintage shopping')).toBe('afternoon');
    expect(anchorBucket(undefined)).toBe('afternoon');
  });
});

describe('theme fit', () => {
  it('anchors only on what the model called direct', () => {
    expect(isAnchor({ themeFit: 'direct' })).toBe(true);
    expect(isAnchor({ themeFit: 'adjacent' })).toBe(false);
    expect(isAnchor({ themeFit: 'none' })).toBe(false);
  });

  // Adjacent is worth having in the day — it is not what the day is built
  // around. A record bar is a good stop on a house music trip; it is not the
  // reason anyone booked it.
  it('counts adjacent as serving the theme without anchoring it', () => {
    expect(servesTheme({ themeFit: 'adjacent' })).toBe(true);
    expect(isAnchor({ themeFit: 'adjacent' })).toBe(false);
  });

  it('treats an untagged candidate as unknown, not as a miss', () => {
    expect(isAnchor({})).toBe(false);
    expect(servesTheme({})).toBe(false);
    expect(themeWeight({})).toBe(0);
  });

  it('ranks direct above adjacent above nothing', () => {
    expect(themeWeight({ themeFit: 'direct' })).toBeGreaterThan(
      themeWeight({ themeFit: 'adjacent' })
    );
    expect(themeWeight({ themeFit: 'adjacent' })).toBeGreaterThan(
      themeWeight({ themeFit: 'none' })
    );
  });
});

/**
 * Absent is unknown, not "none" — the same rule the geographic checks follow
 * without coordinates. Reporting "no day serves your theme" off a missing field
 * would be the same failure as calling a venue closed because its hours are
 * unknown.
 */
describe('poolWasThemeTagged', () => {
  it('is false for a pool nobody judged', () => {
    expect(poolWasThemeTagged([{}, {}, {}])).toBe(false);
  });

  it('is true once anything carries a judgement, including "none"', () => {
    expect(poolWasThemeTagged([{}, { themeFit: 'none' }])).toBe(true);
    expect(poolWasThemeTagged([{ themeFit: 'direct' }])).toBe(true);
  });

  it('is false for an empty pool', () => {
    expect(poolWasThemeTagged([])).toBe(false);
  });
});
