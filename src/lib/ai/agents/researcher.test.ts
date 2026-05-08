import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runResearchAgent } from './researcher';
import type { ResearchRequest } from './types';
import type { UserPreferences } from '@/types/quiz';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

// Mock fetch for Firecrawl
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPreferences: UserPreferences = {
  id: 'test-pref-id',
  userId: 'test-user-id',
  travelMotivations: ['culture', 'food'],
  planningStyle: 'structured_flexible',
  authenticityPreference: 'balanced',
  timeRhythm: 'steady_daytime',
  comfortZone: 6,
  activityTypes: ['museums', 'food tours', 'walking'],
  cuisinePreferences: ['italian', 'local'],
  budgetRange: 'moderate',
  travelPace: 'moderate',
  socialPreferences: 'solo',
  rawAnswers: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRequest: ResearchRequest = {
  destination: 'Paris',
  preferences: mockPreferences,
};

describe('researcher agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('runResearchAgent', () => {
    it('should return research result with correct structure', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = vi.mocked(generateText);

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          attractions: [
            { name: 'Eiffel Tower', description: 'Iconic landmark', category: 'sightseeing', estimatedDuration: 120, priceRange: 'moderate', rating: 4.8 },
            { name: 'Louvre Museum', description: 'World-famous art museum', category: 'museums', estimatedDuration: 180, priceRange: 'moderate', rating: 4.7 },
          ],
          restaurants: [
            { name: 'Le Petit Cler', cuisine: ['french', 'local'], priceRange: 'moderate', rating: 4.5 },
          ],
          activities: [
            { name: 'Seine River Cruise', description: 'Scenic boat ride', category: 'tours', duration: 90, adventureLevel: 2, priceRange: 'moderate' },
          ],
          localInsights: ['Visit museums on the first Sunday for free entry'],
        }),
        // Provide required fields from AI SDK response
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200 },
      } as any);

      const { result, thoughts } = await runResearchAgent(mockRequest);

      expect(result.destination).toBe('Paris');
      expect(result.attractions).toHaveLength(2);
      expect(result.restaurants).toHaveLength(1);
      expect(result.activities).toHaveLength(1);
      expect(result.localInsights).toHaveLength(1);
    });

    it('should attempt to scrape multiple sources', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = vi.mocked(generateText);

      // Mock all Firecrawl scrape calls to fail (no API key in test)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      // Mock the AI analysis call
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          attractions: [{ name: 'Eiffel Tower', description: 'test', category: 'sightseeing', estimatedDuration: 90, priceRange: 'free', rating: 4.5 }],
          restaurants: [{ name: 'Cafe Paris', cuisine: ['french'], priceRange: 'moderate', rating: 4.0 }],
          activities: [{ name: 'Walking Tour', description: 'test', category: 'tours', duration: 120, adventureLevel: 3, priceRange: 'moderate' }],
          localInsights: ['Tip 1'],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200 },
      } as any);

      const { result, thoughts } = await runResearchAgent(mockRequest);

      expect(result.destination).toBe('Paris');
      // Should have thoughts about scraping attempts
      expect(thoughts.some((t) => t.includes('Scraping') || t.includes('scraping') || t.includes('sources'))).toBe(true);
    });

    it('should handle Firecrawl timeout gracefully', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = vi.mocked(generateText);

      // Simulate timeout by rejecting with AbortError
      mockFetch.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

      // Mock fallback AI call
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          attractions: [{ name: 'Fallback Place', description: 'test', category: 'sightseeing', estimatedDuration: 90, priceRange: 'free', rating: 4.0 }],
          restaurants: [],
          activities: [],
          localInsights: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200 },
      } as any);

      const { result } = await runResearchAgent(mockRequest);

      // Should still return valid data via fallback
      expect(result.destination).toBe('Paris');
      expect(result.attractions.length).toBeGreaterThan(0);
    });

    it('should include user preferences in thoughts', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = vi.mocked(generateText);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      mockGenerateText.mockResolvedValueOnce({
        text: '{"attractions":[],"restaurants":[],"activities":[],"localInsights":[]}',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200 },
      } as any);

      const { thoughts } = await runResearchAgent(mockRequest);

      expect(thoughts.some((t) => t.includes('museums'))).toBe(true);
    });
  });
});
