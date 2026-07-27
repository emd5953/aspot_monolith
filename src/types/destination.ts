// Types for destination data fetched via Tavily search

import type { WeeklyHours } from '@/lib/maps/place-verification';

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
  /** Weekly opening hours from Place Details. Absent means unknown, not closed. */
  openingHours?: WeeklyHours;
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
  /** Weekly opening hours from Place Details. Absent means unknown, not closed. */
  openingHours?: WeeklyHours;
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
  /**
   * Present once Google Places resolution confirms the activity is somewhere
   * real. Optional because many activities legitimately have no Places entry
   * (dated events, walking tours, cooking classes) — those stay in the pool
   * unlocated rather than being dropped.
   */
  address?: string;
  coordinates?: { lat: number; lng: number };
  /** Weekly opening hours from Place Details. Absent means unknown, not closed. */
  openingHours?: WeeklyHours;
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
