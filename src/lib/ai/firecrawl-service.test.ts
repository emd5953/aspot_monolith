import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchDestinationData,
  clearDestinationCache,
  isDestinationCached,
} from './firecrawl-service';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('firecrawl-service', () => {
  beforeEach(() => {
    clearDestinationCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchDestinationData', () => {
    it('should return destination data with correct structure', async () => {
      const data = await fetchDestinationData('Paris');

      expect(data).toMatchObject({
        name: 'Paris',
        description: expect.any(String),
        attractions: expect.any(Array),
        restaurants: expect.any(Array),
        activities: expect.any(Array),
        fetchedAt: expect.any(Date),
      });
      expect(data.attractions.length).toBeGreaterThan(0);
      expect(data.restaurants.length).toBeGreaterThan(0);
      expect(data.activities.length).toBeGreaterThan(0);
    });

    it('should include destination name in generated attraction names', async () => {
      const data = await fetchDestinationData('Tokyo');

      data.attractions.forEach((attraction) => {
        expect(attraction.name).toContain('Tokyo');
      });
    });

    it('should cache results and return cached data on second call', async () => {
      const first = await fetchDestinationData('Berlin');
      const second = await fetchDestinationData('Berlin');

      expect(first.name).toBe(second.name);
      expect(first.attractions).toEqual(second.attractions);
    });

    it('should treat cache keys as case-insensitive', async () => {
      await fetchDestinationData('Paris');
      expect(isDestinationCached('paris')).toBe(true);
      expect(isDestinationCached('PARIS')).toBe(true);
      expect(isDestinationCached('Paris')).toBe(true);
    });

    it('should return fallback data when Firecrawl key is not set', async () => {
      // FIRECRAWL_API_KEY is not set in test env, so it should use fallback
      const data = await fetchDestinationData('Rome');

      expect(data.name).toBe('Rome');
      expect(data.attractions.length).toBe(3);
      expect(data.restaurants.length).toBe(3);
      expect(data.activities.length).toBe(3);
    });

    it('should have valid attraction properties', async () => {
      const data = await fetchDestinationData('London');

      data.attractions.forEach((attraction) => {
        expect(attraction).toHaveProperty('name');
        expect(attraction).toHaveProperty('description');
        expect(attraction).toHaveProperty('category');
        expect(attraction).toHaveProperty('estimatedDuration');
        expect(attraction).toHaveProperty('priceRange');
        expect(attraction).toHaveProperty('rating');
        expect(typeof attraction.estimatedDuration).toBe('number');
        expect(typeof attraction.rating).toBe('number');
      });
    });

    it('should have valid restaurant properties', async () => {
      const data = await fetchDestinationData('Barcelona');

      data.restaurants.forEach((restaurant) => {
        expect(restaurant).toHaveProperty('name');
        expect(restaurant).toHaveProperty('cuisine');
        expect(restaurant).toHaveProperty('priceRange');
        expect(restaurant).toHaveProperty('rating');
        expect(Array.isArray(restaurant.cuisine)).toBe(true);
      });
    });
  });

  describe('clearDestinationCache', () => {
    it('should clear all cached data', async () => {
      await fetchDestinationData('Paris');
      expect(isDestinationCached('paris')).toBe(true);

      clearDestinationCache();
      expect(isDestinationCached('paris')).toBe(false);
    });
  });

  describe('isDestinationCached', () => {
    it('should return false for uncached destinations', () => {
      expect(isDestinationCached('Atlantis')).toBe(false);
    });

    it('should return true after fetching', async () => {
      await fetchDestinationData('Sydney');
      expect(isDestinationCached('sydney')).toBe(true);
    });
  });
});
