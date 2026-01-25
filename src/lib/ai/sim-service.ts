/**
 * SIM AI Service
 * 
 * SIM (Simulated Intelligence Model) is the AI reasoning engine that:
 * 1. Takes user preferences + destination data
 * 2. Scores and ranks activities based on user interests
 * 3. Generates personalized recommendations
 * 4. Builds optimized day-by-day itineraries
 * 
 * The AI considers:
 * - User's activity preferences (museums, beaches, nightlife, etc.)
 * - Budget constraints
 * - Travel pace (relaxed vs packed)
 * - Adventure tolerance
 * - Cuisine preferences for restaurant recommendations
 */

import { UserPreferences } from '@/types/quiz';
import { DestinationData, Attraction, Restaurant, ActivityOption } from '@/types/destination';

const SIM_API_KEY = process.env.SIM_API_KEY;
const SIM_API_URL = process.env.SIM_API_URL;

export interface ActivityRecommendation {
  type: 'attraction' | 'restaurant' | 'activity';
  item: Attraction | Restaurant | ActivityOption;
  matchScore: number; // 0-100, how well it matches user preferences
  matchReasons: string[];
  suggestedTimeSlot: 'morning' | 'afternoon' | 'evening';
  suggestedDuration: number; // minutes
}

export interface DayPlan {
  dayNumber: number;
  date: Date;
  activities: ActivityRecommendation[];
  totalDuration: number;
  notes: string;
}

/**
 * Calculate how well an attraction matches user preferences
 */
function scoreAttraction(attraction: Attraction, preferences: UserPreferences): { score: number; reasons: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Check if category matches user's activity types
  const categoryMap: Record<string, string[]> = {
    'sightseeing': ['photography', 'local'],
    'museums': ['museums'],
    'nature': ['hiking', 'beaches'],
    'nightlife': ['nightlife'],
    'shopping': ['shopping'],
    'adventure': ['adventure'],
    'wellness': ['wellness'],
  };

  const matchingActivities = categoryMap[attraction.category] || [];
  const hasMatch = matchingActivities.some(act => preferences.activityTypes.includes(act));
  
  if (hasMatch) {
    score += 30;
    reasons.push(`Matches your interest in ${attraction.category}`);
  }

  // Check budget alignment
  const budgetScore: Record<string, Record<string, number>> = {
    'budget': { 'free': 20, 'budget': 15, 'moderate': 5, 'luxury': -10 },
    'moderate': { 'free': 10, 'budget': 10, 'moderate': 15, 'luxury': 5 },
    'luxury': { 'free': 5, 'budget': 5, 'moderate': 10, 'luxury': 20 },
  };
  
  const priceBonus = budgetScore[preferences.budgetRange]?.[attraction.priceRange] || 0;
  score += priceBonus;
  if (priceBonus > 10) {
    reasons.push('Fits your budget');
  }

  // Rating bonus
  if (attraction.rating && attraction.rating >= 4.5) {
    score += 10;
    reasons.push('Highly rated');
  }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

/**
 * Calculate how well a restaurant matches user preferences
 */
function scoreRestaurant(restaurant: Restaurant, preferences: UserPreferences): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // Check cuisine match
  const cuisineMatch = restaurant.cuisine.some(c => 
    preferences.cuisinePreferences.includes(c)
  );
  
  if (cuisineMatch) {
    score += 25;
    reasons.push(`Serves ${restaurant.cuisine.join(', ')} cuisine`);
  }

  // Budget alignment
  const budgetScore: Record<string, Record<string, number>> = {
    'budget': { 'budget': 20, 'moderate': 5, 'luxury': -15 },
    'moderate': { 'budget': 10, 'moderate': 15, 'luxury': 5 },
    'luxury': { 'budget': 0, 'moderate': 10, 'luxury': 20 },
  };
  
  const priceBonus = budgetScore[preferences.budgetRange]?.[restaurant.priceRange] || 0;
  score += priceBonus;

  // Rating bonus
  if (restaurant.rating && restaurant.rating >= 4.5) {
    score += 15;
    reasons.push('Highly rated');
  }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

/**
 * Calculate how well an activity matches user preferences
 */
function scoreActivity(activity: ActivityOption, preferences: UserPreferences): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // Category match
  if (preferences.activityTypes.includes(activity.category)) {
    score += 30;
    reasons.push(`Matches your interest in ${activity.category}`);
  }

  // Adventure level alignment
  const adventureDiff = Math.abs(activity.adventureLevel - preferences.adventureTolerance);
  if (adventureDiff <= 2) {
    score += 15;
    reasons.push('Matches your adventure level');
  } else if (adventureDiff > 4) {
    score -= 10;
  }

  // Budget alignment
  const budgetScore: Record<string, Record<string, number>> = {
    'budget': { 'budget': 15, 'moderate': 5, 'luxury': -10 },
    'moderate': { 'budget': 10, 'moderate': 15, 'luxury': 5 },
    'luxury': { 'budget': 5, 'moderate': 10, 'luxury': 15 },
  };
  
  const priceBonus = budgetScore[preferences.budgetRange]?.[activity.priceRange] || 0;
  score += priceBonus;

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

/**
 * Generate personalized recommendations from destination data
 */
export async function generateRecommendations(
  preferences: UserPreferences,
  destination: DestinationData,
  tripDuration: number
): Promise<ActivityRecommendation[]> {
  const recommendations: ActivityRecommendation[] = [];

  // Score and add attractions
  for (const attraction of destination.attractions) {
    const { score, reasons } = scoreAttraction(attraction, preferences);
    recommendations.push({
      type: 'attraction',
      item: attraction,
      matchScore: score,
      matchReasons: reasons,
      suggestedTimeSlot: attraction.category === 'nightlife' ? 'evening' : 'morning',
      suggestedDuration: attraction.estimatedDuration,
    });
  }

  // Score and add restaurants
  for (const restaurant of destination.restaurants) {
    const { score, reasons } = scoreRestaurant(restaurant, preferences);
    recommendations.push({
      type: 'restaurant',
      item: restaurant,
      matchScore: score,
      matchReasons: reasons,
      suggestedTimeSlot: 'afternoon', // Lunch time
      suggestedDuration: 90, // 1.5 hours for meals
    });
  }

  // Score and add activities
  for (const activity of destination.activities) {
    const { score, reasons } = scoreActivity(activity, preferences);
    recommendations.push({
      type: 'activity',
      item: activity,
      matchScore: score,
      matchReasons: reasons,
      suggestedTimeSlot: activity.adventureLevel > 5 ? 'morning' : 'afternoon',
      suggestedDuration: activity.duration,
    });
  }

  // Sort by match score
  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  return recommendations;
}

/**
 * Build a day-by-day itinerary from recommendations
 */
export async function buildItinerary(
  recommendations: ActivityRecommendation[],
  tripDuration: number,
  preferences: UserPreferences,
  startDate: Date
): Promise<DayPlan[]> {
  const days: DayPlan[] = [];
  
  // Determine activities per day based on travel pace
  const activitiesPerDay = {
    'relaxed': 3,
    'moderate': 4,
    'packed': 6,
  }[preferences.travelPace];

  // Separate by type for balanced days
  const attractions = recommendations.filter(r => r.type === 'attraction');
  const restaurants = recommendations.filter(r => r.type === 'restaurant');
  const activities = recommendations.filter(r => r.type === 'activity');

  let attractionIndex = 0;
  let restaurantIndex = 0;
  let activityIndex = 0;

  for (let day = 0; day < tripDuration; day++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + day);

    const dayActivities: ActivityRecommendation[] = [];
    let totalDuration = 0;
    const maxDuration = preferences.travelPace === 'relaxed' ? 360 : 
                        preferences.travelPace === 'moderate' ? 480 : 600; // minutes

    // Add morning attraction
    if (attractionIndex < attractions.length && totalDuration < maxDuration) {
      const item = { ...attractions[attractionIndex], suggestedTimeSlot: 'morning' as const };
      dayActivities.push(item);
      totalDuration += item.suggestedDuration;
      attractionIndex++;
    }

    // Add lunch restaurant
    if (restaurantIndex < restaurants.length && totalDuration < maxDuration) {
      const item = { ...restaurants[restaurantIndex], suggestedTimeSlot: 'afternoon' as const };
      dayActivities.push(item);
      totalDuration += item.suggestedDuration;
      restaurantIndex++;
    }

    // Add afternoon activity
    if (activityIndex < activities.length && totalDuration < maxDuration) {
      const item = { ...activities[activityIndex], suggestedTimeSlot: 'afternoon' as const };
      dayActivities.push(item);
      totalDuration += item.suggestedDuration;
      activityIndex++;
    }

    // Add evening attraction if pace allows
    if (preferences.travelPace !== 'relaxed' && attractionIndex < attractions.length && totalDuration < maxDuration) {
      const item = { ...attractions[attractionIndex], suggestedTimeSlot: 'evening' as const };
      dayActivities.push(item);
      totalDuration += item.suggestedDuration;
      attractionIndex++;
    }

    days.push({
      dayNumber: day + 1,
      date: dayDate,
      activities: dayActivities,
      totalDuration,
      notes: day === 0 ? 'Arrival day - take it easy!' : 
             day === tripDuration - 1 ? 'Last day - enjoy!' : '',
    });
  }

  return days;
}

/**
 * Call external SIM API for more sophisticated recommendations
 * Falls back to local scoring if API is not configured
 */
export async function callSimApi(
  prompt: string,
  context: Record<string, unknown>
): Promise<string> {
  if (!SIM_API_KEY || SIM_API_KEY === 'your-sim-api-key' || !SIM_API_URL) {
    // Return empty - will use local scoring instead
    return '';
  }

  try {
    const response = await fetch(SIM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SIM_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        context,
      }),
    });

    if (!response.ok) {
      throw new Error(`SIM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('SIM API call failed:', error);
    return '';
  }
}
