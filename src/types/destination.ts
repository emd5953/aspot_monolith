// Types for destination data fetched via Firecrawl

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
  fetchedAt: Date;
}
