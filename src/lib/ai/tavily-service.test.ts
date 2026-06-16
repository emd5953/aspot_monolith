import { describe, it, expect } from 'vitest';
import {
  buildRedditSearchQueries,
  countRedditMentions,
  type SearchHit,
} from './tavily-service';
import { UserPreferences } from '@/types/quiz';

/**
 * The Reddit research pass is two pure pieces: a query builder that scopes
 * Tavily to reddit.com with the user's intent leading, and a mention-counter
 * that turns Reddit hits into the `redditMentions` provenance signal. These
 * tests lock in both so the wiring in fetchDestinationDataWithPrefs stays sound.
 */

const basePrefs: UserPreferences = {
  id: '',
  userId: '',
  travelMotivations: [],
  planningStyle: 'structured_flexible',
  authenticityPreference: 'balanced',
  timeRhythm: 'steady_daytime',
  comfortZone: 5,
  activityTypes: ['live music', 'bars', 'art'],
  cuisinePreferences: ['japanese', 'ramen'],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  socialPreferences: 'couple',
  rawAnswers: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const hit = (title: string, content: string): SearchHit => ({
  title,
  content,
  url: 'https://reddit.com/r/nyc/x',
  score: 0.5,
});

describe('buildRedditSearchQueries', () => {
  it('scopes every query to reddit.com', () => {
    const q = buildRedditSearchQueries('NYC', basePrefs, 'R&B bars');
    expect(q.attractions).toMatch(/^site:reddit\.com/);
    expect(q.restaurants).toMatch(/^site:reddit\.com/);
    expect(q.activities).toMatch(/^site:reddit\.com/);
  });

  it('leads with user intent for relevance weighting', () => {
    const q = buildRedditSearchQueries('NYC', basePrefs, 'R&B bars');
    // intent sits right after the site: operator, ahead of the generic focus
    expect(q.restaurants).toMatch(/^site:reddit\.com R&B bars/);
  });

  it('includes the destination in each query', () => {
    const q = buildRedditSearchQueries('Lisbon', basePrefs, '');
    expect(q.attractions).toContain('in Lisbon');
    expect(q.restaurants).toContain('in Lisbon');
    expect(q.activities).toContain('in Lisbon');
  });

  it('folds in preference signals (interests, cuisines)', () => {
    const q = buildRedditSearchQueries('NYC', basePrefs, '');
    expect(q.attractions).toContain('live music');
    expect(q.restaurants).toContain('japanese');
  });

  it('collapses whitespace when intent is empty', () => {
    const q = buildRedditSearchQueries('NYC', basePrefs, '');
    expect(q.attractions).not.toMatch(/\s{2,}/);
    expect(q.attractions.trim()).toBe(q.attractions);
  });

  it('is deterministic for identical inputs', () => {
    const a = buildRedditSearchQueries('NYC', basePrefs, 'jazz');
    const b = buildRedditSearchQueries('NYC', basePrefs, 'jazz');
    expect(a).toEqual(b);
  });
});

describe('countRedditMentions', () => {
  const hits = [
    hit('Best bars in NYC', 'Everyone keeps recommending The Dead Rabbit lately'),
    hit('NYC nightlife thread', 'The Dead Rabbit is overrated imo, try Attaboy'),
    hit('Where to drink', 'Attaboy and Katz are the move'),
  ];

  it('counts each hit at most once', () => {
    expect(countRedditMentions('The Dead Rabbit', hits)).toBe(2);
  });

  it('is case-insensitive', () => {
    expect(countRedditMentions('attaboy', hits)).toBe(2);
  });

  it('returns 0 for an unmentioned place', () => {
    expect(countRedditMentions('Le Bernardin', hits)).toBe(0);
  });

  it('returns 0 for an empty name', () => {
    expect(countRedditMentions('   ', hits)).toBe(0);
  });

  it('returns 0 when there are no hits', () => {
    expect(countRedditMentions('Attaboy', [])).toBe(0);
  });
});
