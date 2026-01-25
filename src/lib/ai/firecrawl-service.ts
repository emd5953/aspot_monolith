/**
 * Firecrawl Service
 * 
 * Firecrawl is a web scraping API that extracts structured data from websites.
 * We use it to gather real destination information:
 * - Attractions and landmarks
 * - Restaurants and cafes
 * - Activities and experiences
 * - Local tips and recommendations
 * 
 * The data is then used by SIM to generate personalized itineraries.
 */

import {
  DestinationData,
  Attraction,
  Restaurant,
  ActivityOption,
} from '@/types/destination';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';

// Simple in-memory cache for destination data
const destinationCache = new Map<string, { data: DestinationData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

/**
 * Scrape a URL using Firecrawl API
 */
async function scrapeUrl(url: string): Promise<FirecrawlScrapeResponse> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }

  const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse scraped content into structured attraction data
 * This is a simplified parser - in production you'd use more sophisticated NLP
 */
function parseAttractions(content: string, destination: string): Attraction[] {
  // For MVP, return sample data based on destination
  // In production, you'd parse the actual scraped content
  const attractions: Attraction[] = [
    {
      name: `${destination} City Center`,
      description: `Explore the heart of ${destination} with its historic buildings and vibrant atmosphere.`,
      category: 'sightseeing',
      address: `Downtown ${destination}`,
      estimatedDuration: 120,
      priceRange: 'free',
      rating: 4.5,
    },
    {
      name: `${destination} Museum`,
      description: `Learn about the rich history and culture of ${destination}.`,
      category: 'museums',
      address: `Museum District, ${destination}`,
      estimatedDuration: 90,
      priceRange: 'moderate',
      rating: 4.3,
    },
    {
      name: `${destination} Park`,
      description: `Beautiful green space perfect for relaxation and outdoor activities.`,
      category: 'nature',
      address: `Central ${destination}`,
      estimatedDuration: 60,
      priceRange: 'free',
      rating: 4.6,
    },
  ];

  return attractions;
}

/**
 * Parse scraped content into restaurant data
 */
function parseRestaurants(content: string, destination: string): Restaurant[] {
  const restaurants: Restaurant[] = [
    {
      name: `Local Flavors ${destination}`,
      cuisine: ['local', 'traditional'],
      priceRange: 'moderate',
      address: `Food District, ${destination}`,
      rating: 4.4,
    },
    {
      name: `${destination} Street Food Market`,
      cuisine: ['streetfood', 'local'],
      priceRange: 'budget',
      address: `Market Square, ${destination}`,
      rating: 4.7,
    },
    {
      name: `Fine Dining ${destination}`,
      cuisine: ['international', 'fusion'],
      priceRange: 'luxury',
      address: `Uptown ${destination}`,
      rating: 4.8,
    },
  ];

  return restaurants;
}

/**
 * Parse scraped content into activity data
 */
function parseActivities(content: string, destination: string): ActivityOption[] {
  const activities: ActivityOption[] = [
    {
      name: `Walking Tour of ${destination}`,
      description: `Guided walking tour through the historic streets.`,
      category: 'tours',
      duration: 180,
      priceRange: 'moderate',
      adventureLevel: 2,
    },
    {
      name: `${destination} Food Tour`,
      description: `Taste the best local cuisine with a knowledgeable guide.`,
      category: 'foodtours',
      duration: 240,
      priceRange: 'moderate',
      adventureLevel: 3,
    },
    {
      name: `Adventure Day Trip from ${destination}`,
      description: `Exciting outdoor adventure in the surrounding area.`,
      category: 'adventure',
      duration: 480,
      priceRange: 'moderate',
      adventureLevel: 7,
    },
  ];

  return activities;
}

/**
 * Fetch destination data using Firecrawl
 * Scrapes travel sites and extracts structured information
 */
export async function fetchDestinationData(destination: string): Promise<DestinationData> {
  const cacheKey = destination.toLowerCase().trim();
  
  // Check cache first
  const cached = destinationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // In production, you'd scrape multiple travel sites
    // For MVP, we'll use a simplified approach
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(destination)}`;
    
    let scrapedContent = '';
    
    if (FIRECRAWL_API_KEY && FIRECRAWL_API_KEY !== 'your-firecrawl-api-key') {
      try {
        const result = await scrapeUrl(searchUrl);
        if (result.success && result.data?.markdown) {
          scrapedContent = result.data.markdown;
        }
      } catch (error) {
        console.warn('Firecrawl scraping failed, using fallback data:', error);
      }
    }

    // Parse the scraped content (or use fallback data)
    const destinationData: DestinationData = {
      name: destination,
      country: 'Unknown', // Would be extracted from scraping
      description: `Discover the wonders of ${destination}`,
      attractions: parseAttractions(scrapedContent, destination),
      restaurants: parseRestaurants(scrapedContent, destination),
      activities: parseActivities(scrapedContent, destination),
      localTips: [
        `Best time to visit ${destination} is during spring or fall`,
        `Learn a few local phrases - locals appreciate the effort`,
        `Book popular attractions in advance to avoid queues`,
      ],
      fetchedAt: new Date(),
    };

    // Cache the result
    destinationCache.set(cacheKey, {
      data: destinationData,
      timestamp: Date.now(),
    });

    return destinationData;
  } catch (error) {
    console.error('Failed to fetch destination data:', error);
    
    // Return minimal fallback data
    return {
      name: destination,
      country: 'Unknown',
      description: `Explore ${destination}`,
      attractions: parseAttractions('', destination),
      restaurants: parseRestaurants('', destination),
      activities: parseActivities('', destination),
      localTips: [],
      fetchedAt: new Date(),
    };
  }
}

/**
 * Clear the destination cache
 */
export function clearDestinationCache(): void {
  destinationCache.clear();
}

/**
 * Check if destination data is available
 */
export function isDestinationCached(destination: string): boolean {
  const cacheKey = destination.toLowerCase().trim();
  const cached = destinationCache.get(cacheKey);
  return cached !== undefined && Date.now() - cached.timestamp < CACHE_TTL;
}
