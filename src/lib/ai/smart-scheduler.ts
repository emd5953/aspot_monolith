/**
 * Smart Scheduler Service
 * 
 * Handles intelligent time allocation for activities:
 * - Assigns realistic start/end times
 * - Ensures gaps between activities (travel time)
 * - Smart meal suggestions at appropriate times
 * - Activity duration based on category
 * - Respects activity density preferences
 */

export interface ScheduledActivity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
}

export interface SchedulingOptions {
  activityDensity: 'relaxed' | 'moderate' | 'packed';
  startTime?: string; // Default: 09:00
  endTime?: string; // Default: 22:00
  mealPreferences?: string[];
}

// Activity duration estimates by category (in minutes)
const DURATION_BY_CATEGORY: Record<string, number> = {
  attraction: 90,
  museum: 120,
  dining: 75,
  breakfast: 45,
  lunch: 60,
  dinner: 90,
  activity: 120,
  shopping: 90,
  transport: 30,
  accommodation: 0, // No time allocation
  entertainment: 150,
  nightlife: 180,
  nature: 120,
  beach: 180,
  sports: 120,
};

// Minimum gap between activities (travel time)
const TRAVEL_TIME_MINUTES = 20;

// Meal time windows
const MEAL_WINDOWS = {
  breakfast: { start: '08:00', end: '10:00' },
  lunch: { start: '12:00', end: '14:00' },
  dinner: { start: '18:30', end: '20:30' },
};

/**
 * Schedule activities throughout the day with smart timing
 */
export function scheduleActivities(
  activities: Omit<ScheduledActivity, 'startTime' | 'endTime' | 'duration'>[],
  options: SchedulingOptions
): ScheduledActivity[] {
  const { activityDensity, startTime = '09:00', endTime = '22:00' } = options;
  
  // Determine target number of activities based on density
  const targetCounts = {
    very_relaxed: { min: 2, max: 3 },
    relaxed: { min: 3, max: 4 },
    moderate: { min: 5, max: 6 },
    packed: { min: 8, max: 10 },
    intense: { min: 10, max: 12 },
  };
  
  const target = targetCounts[activityDensity];
  
  // Filter activities to match density (keep most important ones)
  let filteredActivities = activities.slice(0, target.max);
  
  // Insert meal activities at appropriate times
  const activitiesWithMeals = insertMealActivities(filteredActivities, options);
  
  // Schedule each activity with start/end times
  const scheduled: ScheduledActivity[] = [];
  let currentTime = parseTime(startTime);
  const dayEndTime = parseTime(endTime);
  
  for (let i = 0; i < activitiesWithMeals.length; i++) {
    const activity = activitiesWithMeals[i];
    
    // Get duration for this activity
    const duration = getDuration(activity.category);
    
    // Check if activity is a meal - schedule at preferred time
    if (activity.category === 'breakfast' || activity.category === 'lunch' || activity.category === 'dinner') {
      const mealWindow = MEAL_WINDOWS[activity.category as keyof typeof MEAL_WINDOWS];
      const preferredTime = parseTime(mealWindow.start);
      
      // If we haven't reached meal time yet, jump to it
      if (currentTime < preferredTime) {
        currentTime = preferredTime;
      }
    }
    
    // Calculate end time
    const endTimeMinutes = currentTime + duration;
    
    // Check if we exceed day end time
    if (endTimeMinutes > dayEndTime) {
      console.warn(`Activity ${activity.title} exceeds day end time, skipping`);
      break;
    }
    
    scheduled.push({
      ...activity,
      startTime: formatTime(currentTime),
      endTime: formatTime(endTimeMinutes),
      duration,
    });
    
    // Add travel time gap before next activity
    currentTime = endTimeMinutes + TRAVEL_TIME_MINUTES;
  }
  
  return scheduled;
}

/**
 * Insert meal activities at appropriate times
 */
function insertMealActivities(
  activities: Omit<ScheduledActivity, 'startTime' | 'endTime' | 'duration'>[],
  options: SchedulingOptions
): Omit<ScheduledActivity, 'startTime' | 'endTime' | 'duration'>[] {
  const result = [...activities];
  const mealPreferences = options.mealPreferences || [];
  
  // Check if meals already exist
  const hasBreakfast = activities.some(a => a.category === 'breakfast' || a.category === 'dining' && a.title.toLowerCase().includes('breakfast'));
  const hasLunch = activities.some(a => a.category === 'lunch' || a.category === 'dining' && a.title.toLowerCase().includes('lunch'));
  const hasDinner = activities.some(a => a.category === 'dinner' || a.category === 'dining' && a.title.toLowerCase().includes('dinner'));
  
  // Add breakfast if missing
  if (!hasBreakfast) {
    result.unshift({
      id: `meal-breakfast-${Date.now()}`,
      title: getSmartMealSuggestion('breakfast', mealPreferences),
      description: 'Start your day with a delicious breakfast',
      category: 'breakfast',
      sortOrder: 0,
    });
  }
  
  // Add lunch in the middle
  if (!hasLunch) {
    const lunchIndex = Math.floor(result.length / 2);
    result.splice(lunchIndex, 0, {
      id: `meal-lunch-${Date.now()}`,
      title: getSmartMealSuggestion('lunch', mealPreferences),
      description: 'Refuel with a midday meal',
      category: 'lunch',
      sortOrder: lunchIndex,
    });
  }
  
  // Add dinner at the end
  if (!hasDinner) {
    result.push({
      id: `meal-dinner-${Date.now()}`,
      title: getSmartMealSuggestion('dinner', mealPreferences),
      description: 'End your day with a memorable dinner',
      category: 'dinner',
      sortOrder: result.length,
    });
  }
  
  return result;
}

/**
 * Get smart meal suggestions based on preferences
 */
function getSmartMealSuggestion(mealType: 'breakfast' | 'lunch' | 'dinner', preferences: string[]): string {
  const suggestions: Record<string, Record<string, string[]>> = {
    breakfast: {
      default: ['Local Café Breakfast', 'Hotel Breakfast Buffet', 'Artisan Bakery & Coffee'],
      italian: ['Italian Café & Cornetto', 'Cappuccino & Pastries'],
      asian: ['Dim Sum Breakfast', 'Congee & Tea', 'Noodle Soup'],
      american: ['Classic Diner Breakfast', 'Pancake House'],
      french: ['French Café & Croissants', 'Boulangerie Breakfast'],
    },
    lunch: {
      default: ['Local Restaurant Lunch', 'Casual Bistro', 'Street Food Market'],
      italian: ['Trattoria Lunch', 'Pizza & Pasta', 'Osteria'],
      asian: ['Ramen Shop', 'Sushi Lunch', 'Pho Restaurant'],
      mexican: ['Taqueria', 'Mexican Cantina'],
      mediterranean: ['Mediterranean Mezze', 'Greek Taverna'],
    },
    dinner: {
      default: ['Fine Dining Experience', 'Local Specialty Restaurant', 'Rooftop Dinner'],
      italian: ['Authentic Italian Ristorante', 'Michelin-Rated Italian'],
      asian: ['Upscale Asian Fusion', 'Traditional Japanese Kaiseki', 'Thai Fine Dining'],
      seafood: ['Fresh Seafood Restaurant', 'Waterfront Seafood'],
      steakhouse: ['Premium Steakhouse', 'Local Grill House'],
    },
  };
  
  // Find matching cuisine preference
  for (const pref of preferences) {
    const prefLower = pref.toLowerCase();
    if (suggestions[mealType][prefLower]) {
      const options = suggestions[mealType][prefLower];
      return options[Math.floor(Math.random() * options.length)];
    }
  }
  
  // Default suggestion
  const defaultOptions = suggestions[mealType].default;
  return defaultOptions[Math.floor(Math.random() * defaultOptions.length)];
}

/**
 * Get duration for activity category
 */
function getDuration(category: string): number {
  return DURATION_BY_CATEGORY[category.toLowerCase()] || 90;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to time string (HH:MM)
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate total duration for a set of activities
 */
export function calculateTotalDuration(activities: ScheduledActivity[]): number {
  return activities.reduce((total, activity) => total + activity.duration, 0);
}

/**
 * Validate schedule doesn't have overlapping times
 */
export function validateSchedule(activities: ScheduledActivity[]): boolean {
  for (let i = 0; i < activities.length - 1; i++) {
    const current = activities[i];
    const next = activities[i + 1];
    
    const currentEnd = parseTime(current.endTime);
    const nextStart = parseTime(next.startTime);
    
    if (currentEnd > nextStart) {
      console.error(`Overlap detected: ${current.title} ends at ${current.endTime} but ${next.title} starts at ${next.startTime}`);
      return false;
    }
  }
  
  return true;
}
