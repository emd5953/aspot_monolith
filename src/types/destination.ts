// Types for destination data fetched via Tavily search

/**
 * Provenance signal shared by every candidate type: how many Reddit search
 * hits named this place. A place with several Reddit threads vouching for it
 * is local-favorite evidence the scorer/planner can lean on. 0 (or undefined)
 * when no Reddit research pass ran.
 */

export interface Attraction {
  name: string;
  description: string;
  category: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  estimatedDuration: number; // minutes
  priceRange: string;
  rating?: number;
  url?: string;
  imageUrl?: string;
  redditMentions?: number;
}

export interface Restaurant {
  name: string;
  cuisine: string[];
  priceRange: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  rating?: number;
  url?: string;
  imageUrl?: string;
  redditMentions?: number;
}

export interface ActivityOption {
  name: string;
  description: string;
  category: string;
  duration: number; // minutes
  priceRange: string;
  adventureLevel: number; // 1-10
  url?: string;
  imageUrl?: string;
  redditMentions?: number;
}

export interface WeatherInfo {
  averageTemp: number;
  climate: string;
  bestMonths: string[];
  rainyMonths: string[];
}

export interface DestinationData {
  name: string;
  country: string;
  description: string;
  attractions: Attraction[];
  restaurants: Restaurant[];
  activities: ActivityOption[];
  localTips: string[];
  weatherInfo?: WeatherInfo;
  /** Unique source URLs the research was extracted from (Tavily search hits). */
  sources: string[];
  fetchedAt: Date;
}
