import { describe, it, expect } from 'vitest';
import {
  deriveSource,
  normalizeName,
  buildProvenanceIndex,
  lookupSource,
} from './provenance';

describe('deriveSource', () => {
  it('treats any reddit mention as a Reddit favorite', () => {
    expect(deriveSource({ redditMentions: 1 })).toBe('reddit');
    expect(deriveSource({ redditMentions: 5, coordinates: { lat: 1, lng: 2 } })).toBe('reddit');
  });

  it('treats a resolved coordinate as Google-verified', () => {
    expect(deriveSource({ coordinates: { lat: 40.7, lng: -74 } })).toBe('places');
    expect(deriveSource({ redditMentions: 0, coordinates: { lat: 40.7, lng: -74 } })).toBe('places');
  });

  it('falls back to web research when only a plain candidate exists', () => {
    expect(deriveSource({})).toBe('tavily');
    expect(deriveSource({ redditMentions: 0 })).toBe('tavily');
    expect(deriveSource({ coordinates: null })).toBe('tavily');
  });

  it('reports missing signals as an AI suggestion', () => {
    expect(deriveSource(undefined)).toBe('ai');
    expect(deriveSource(null)).toBe('ai');
  });

  it('does not treat non-finite coordinates as verified', () => {
    expect(deriveSource({ coordinates: { lat: NaN, lng: NaN } })).toBe('tavily');
  });
});

describe('normalizeName', () => {
  it('lowercases and collapses punctuation to spaces', () => {
    expect(normalizeName("Joe's  Pizza!")).toBe('joe s pizza');
    expect(normalizeName('THE Dead-Rabbit')).toBe('the dead rabbit');
  });
});

describe('buildProvenanceIndex + lookupSource', () => {
  it('matches planner item names back to their research source regardless of casing/punctuation', () => {
    const index = buildProvenanceIndex([
      { name: 'The Dead Rabbit', redditMentions: 3 },
      { name: "Joe's Pizza", coordinates: { lat: 40.7, lng: -74 } },
      { name: 'Some Museum' },
    ]);

    expect(lookupSource('the dead rabbit', index)).toBe('reddit');
    expect(lookupSource("JOE'S PIZZA", index)).toBe('places');
    expect(lookupSource('Some Museum', index)).toBe('tavily');
  });

  it('reports an unmatched (planner-invented) name as an AI suggestion', () => {
    const index = buildProvenanceIndex([{ name: 'Real Place', redditMentions: 1 }]);
    expect(lookupSource('A Place The AI Made Up', index)).toBe('ai');
  });

  it('upgrades to the strongest source when a name appears with different signals', () => {
    const index = buildProvenanceIndex([
      { name: 'Blue Bottle', coordinates: { lat: 1, lng: 2 } }, // places
      { name: 'Blue Bottle', redditMentions: 4 }, // reddit — stronger
    ]);
    expect(lookupSource('blue bottle', index)).toBe('reddit');
  });

  it('skips blank names', () => {
    const index = buildProvenanceIndex([{ name: '   ', redditMentions: 9 }]);
    expect(index.size).toBe(0);
  });
});
