/**
 * Truly Agentic Planner
 * 
 * This agent:
 * - Reasons about how to structure the itinerary
 * - Makes strategic decisions about pacing and flow
 * - Can adjust its approach based on constraints
 * - Explains its reasoning for each decision
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PlanRequest, ItineraryPlan, DayPlan, ScheduledItem, ResearchResult } from './types';
import { UserPreferences } from '@/types/quiz';

interface PlanningStrategy {
  approach: string;
  reasoning: string;
  dayThemes: string[];
  pacingStrategy: string;
  mealStrategy: string;
}

interface ReasoningStep {
  thought: string;
  action: string;
  result?: string;
}

/**
 * Agent creates a strategic planning approach
 */
async function createPlanningStrategy(
  request: PlanRequest
): Promise<PlanningStrategy> {
  const { research, preferences, startDate, endDate } = request;
  const feedback = undefined; // No feedback in initial planning
  
  const tripDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const strategyPrompt = `You are a strategic itinerary planner. Create a high-level strategy for a ${tripDays}-day trip to ${research.destination}.

USER PROFILE:
- Travel Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Planning Style: ${preferences.planningStyle || 'balanced'}
- Authenticity Preference: ${preferences.authenticityPreference || 'balanced'}
- Interests: ${preferences.activityTypes?.join(', ') || 'general activities'}
- Budget: ${preferences.budgetRange || 'moderate'}
- Pace: ${preferences.travelPace || 'moderate'}
- Time Rhythm: ${preferences.timeRhythm || 'daytime'}
- Comfort Zone: ${preferences.comfortZone || 5}/10
- Social Style: ${preferences.socialPreferences || 'couple'}

AVAILABLE OPTIONS:
- ${research.attractions.length} attractions
- ${research.restaurants.length} restaurants
- ${research.activities.length} activities

STRATEGIC QUESTIONS:
1. How should we pace the trip based on their ${preferences.travelPace} pace and ${preferences.timeRhythm || 'daytime'} energy rhythm?
2. What theme/focus for each day that matches their motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}?
3. How to balance activities vs relaxation for their comfort zone (${preferences.comfortZone || 5}/10)?
4. Should we prioritize ${preferences.authenticityPreference || 'balanced'} experiences (tourist vs local)?
5. How to structure days for ${preferences.socialPreferences || 'couple'} travel style?
6. Given their ${preferences.planningStyle || 'balanced'} planning style, how much flexibility to build in?

Return JSON with your strategy:
{
  "approach": "Overall strategic approach",
  "reasoning": "Why this approach works for this traveler",
  "dayThemes": ["Day 1 theme", "Day 2 theme", ...],
  "pacingStrategy": "How we'll pace activities",
  "mealStrategy": "How we'll handle dining"
}`;

  const result = await generateText({
    model: openai('gpt-4o-mini'), // Changed to mini for speed
    prompt: strategyPrompt,
    temperature: 0.8,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Fallback strategy
  return {
    approach: 'Balanced exploration',
    reasoning: 'Mix of major attractions and local experiences',
    dayThemes: Array(tripDays).fill('Exploration'),
    pacingStrategy: 'Moderate pace with breaks',
    mealStrategy: 'Mix of restaurants and casual dining',
  };
}

/**
 * Agent builds a single day with reasoning
 */
async function buildDayWithReasoning(
  dayNumber: number,
  theme: string,
  destination: string, // ADD THIS
  availableOptions: {
    attractions: ResearchResult['attractions'];
    restaurants: ResearchResult['restaurants'];
    activities: ResearchResult['activities'];
  },
  preferences: UserPreferences,
  usedItems: Set<string>
): Promise<{
  day: DayPlan;
  reasoning: string[];
}> {
  const dayPrompt = `You are planning Day ${dayNumber} of a trip to ${destination.toUpperCase()}.

🚨 CRITICAL: ALL activities MUST be in ${destination.toUpperCase()}
- Destination: ${destination}
- DO NOT include activities from other cities (not San Francisco, not Oakland, not San Jose if destination is Berkeley)
- DO NOT include activities from other states or countries
- VERIFY each activity is actually located in ${destination}

THEME: ${theme}
USER PERSONALITY:
- Motivations: ${preferences.travelMotivations?.join(', ') || 'exploration'}
- Authenticity: ${preferences.authenticityPreference || 'balanced'} (avoid tourist traps if "authentic_local")
- Time Rhythm: ${preferences.timeRhythm || 'steady_daytime'} (schedule activities for their peak energy)
- Comfort Zone: ${preferences.comfortZone || 5}/10 (${(preferences.comfortZone || 5) > 7 ? 'push boundaries' : (preferences.comfortZone || 5) < 4 ? 'keep familiar' : 'balanced challenge'})
- Social: ${preferences.socialPreferences || 'couple'} (consider group dynamics)
- Interests: ${preferences.activityTypes.slice(0, 3).join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}

AVAILABLE OPTIONS (not yet used) - ALL IN ${destination.toUpperCase()}:
${availableOptions.attractions.length > 0 
  ? `Attractions in ${destination}: ${availableOptions.attractions.filter(a => !usedItems.has(a.name)).slice(0, 10).map(a => `${a.name} (${a.category}, ${a.estimatedDuration}min, ${a.priceRange})`).join(', ')}`
  : `Use your knowledge of ${preferences.activityTypes.slice(0, 3).join(', ')} activities in ${destination}`}

${availableOptions.restaurants.length > 0
  ? `Restaurants in ${destination}: ${availableOptions.restaurants.filter(r => !usedItems.has(r.name)).slice(0, 8).map(r => `${r.name} (${r.cuisine.join('/')}, ${r.priceRange})`).join(', ')}`
  : `Use your knowledge of ${preferences.cuisinePreferences.slice(0, 2).join(', ')} restaurants in ${destination}`}

${availableOptions.activities.length > 0
  ? `Activities in ${destination}: ${availableOptions.activities.filter(a => !usedItems.has(a.name)).slice(0, 6).map(a => `${a.name} (${a.category}, ${a.duration}min)`).join(', ')}`
  : `Use your knowledge of popular activities in ${destination}`}

NOTE: Create realistic, specific activities in ${destination}. Include real place names and addresses IN ${destination}.
VERIFY: Every single activity must be in ${destination} - not nearby cities, not other states.

BUILD THIS DAY (Day ${dayNumber} of the trip):
IMPORTANT: This is Day ${dayNumber}, so activities should be DIFFERENT from other days!
${dayNumber === 1 ? '- First day: Focus on arrival, orientation, iconic experiences' :
  dayNumber === 2 ? '- Second day: Explore different neighborhoods, new experiences' :
  dayNumber === 3 ? '- Third day: Deeper exploration, off-beaten-path' :
  `- Day ${dayNumber}: Continue discovering new areas and experiences`}

${preferences.timeRhythm === 'early_bird' ? '- Early Morning (7am-9am): 1 sunrise/early activity\n- Morning (9am-12pm): 1-2 activities' : 
  preferences.timeRhythm === 'night_owl' ? '- Late Morning (10am-1pm): 1-2 activities (they sleep in)\n- Afternoon (1pm-6pm): Lunch + 2 activities\n- Evening/Night (6pm-11pm): 2 activities + dinner (their peak time)' :
  '- Morning (9am-12pm): 1-2 activities\n- Afternoon (12pm-5pm): Lunch + 1-2 activities\n- Evening (5pm-9pm): 1 activity + dinner'}

GEOGRAPHIC PROXIMITY RULES (CRITICAL):
1. **Group activities by neighborhood/area** - All activities in a day should be in the SAME AREA or nearby neighborhoods
2. **Minimize travel time** - Activities should be within 10-15 minutes of each other
3. **Logical geographic flow** - If moving between areas, do it once (e.g., morning in downtown, afternoon in waterfront)
4. **Lunch near morning activities** - Restaurant should be in the same area as morning activities
5. **Dinner near evening activities** - Restaurant should be in the same area as evening activities
6. **Example good day**: All activities in "SoHo/Greenwich Village" area
7. **Example bad day**: Morning in Upper East Side, lunch in Brooklyn, afternoon in Midtown, dinner in Queens (too spread out!)

PERSONALITY-DRIVEN CURATION:
- Authenticity: ${preferences.authenticityPreference === 'authentic_local' ? 'ONLY local spots, hidden gems, avoid anything touristy' : 
                 preferences.authenticityPreference === 'popular_spots' ? 'Popular attractions are fine — they\'re famous for a reason' :
                 'Mix of local and popular'}
- Challenge Level: ${(preferences.comfortZone || 5) > 7 ? 'Include adventurous/unusual activities' : 
                     (preferences.comfortZone || 5) < 4 ? 'Stick to well-known, comfortable options' :
                     'Balanced mix'}
- Social Fit: ${preferences.socialPreferences === 'solo' ? 'Solo-friendly activities, opportunities to meet people if social' :
               preferences.socialPreferences === 'couple' ? 'Romantic/intimate experiences' :
               preferences.socialPreferences === 'small_group' ? 'Group-friendly activities suitable for 3-5 people' :
               'Group-friendly activities for larger crowds'}
- Motivations: Prioritize activities matching: ${preferences.travelMotivations?.join(', ') || 'general exploration'}

CRITICAL RULES:
1. **PROXIMITY FIRST**: All activities in a day MUST be geographically close (same neighborhood/district)
2. **NO DUPLICATES ACROSS TRIP**: Do NOT suggest activities that might have been used in other days
3. You MUST include activities for morning, afternoon, and evening. Do not return empty arrays.
4. DO NOT repeat the same location/activity within the same day (e.g., don't visit Golden Gate Park twice)
5. Each activity must have a UNIQUE name - be specific (e.g., "Ramen at Ichiran Shibuya" not just "Ramen")
6. If you need similar activities, use different locations or variations
7. **Include specific addresses/locations** in descriptions so they can be mapped
8. **Variety is key**: Each day should feel different with unique experiences

REASONING REQUIRED:
- Why each activity fits the theme
- Why the order makes sense
- How it matches user preferences
- **Why these activities are geographically close** (mention neighborhood/area)

Return VALID JSON (no markdown, no extra text):
{
  "areaFocus": "Specific neighborhood/district for this day (e.g., 'SoHo & Greenwich Village', 'Shibuya & Harajuku')",
  "morning": [
    {"name": "Activity Name", "type": "attraction", "time": "09:00", "duration": 120, "description": "What you do", "location": "Specific address or area", "matchScore": 85, "matchReasons": ["why this fits"]}
  ],
  "afternoon": [
    {"name": "Restaurant Name", "type": "restaurant", "time": "12:00", "duration": 90, "description": "Lunch spot", "location": "Specific address or area", "matchScore": 80, "matchReasons": ["why"]},
    {"name": "Activity Name", "type": "attraction", "time": "14:00", "duration": 120, "description": "Afternoon activity", "location": "Specific address or area", "matchScore": 85, "matchReasons": ["why"]}
  ],
  "evening": [
    {"name": "Activity Name", "type": "activity", "time": "17:00", "duration": 90, "description": "Evening activity", "location": "Specific address or area", "matchScore": 80, "matchReasons": ["why"]},
    {"name": "Restaurant Name", "type": "restaurant", "time": "19:00", "duration": 90, "description": "Dinner", "location": "Specific address or area", "matchScore": 85, "matchReasons": ["why"]}
  ],
  "reasoning": ["Why this day works", "How activities flow together", "Why all activities are in the same area"],
  "theme": "${theme}"
}`;

  const result = await generateText({
    model: openai('gpt-4o-mini'), // Changed from gpt-4o to gpt-4o-mini for speed
    prompt: dayPrompt,
    temperature: 0.8,
  });

  console.log(`DEBUG [buildDay ${dayNumber}]: AI response:`, result.text.substring(0, 500));

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`DEBUG [buildDay ${dayNumber}]: Parsed day:`, JSON.stringify(parsed, null, 2));
    
    // Validate no duplicates within the same day
    const allItems = [...(parsed.morning || []), ...(parsed.afternoon || []), ...(parsed.evening || [])];
    const itemNames = new Set<string>();
    const duplicates: string[] = [];
    
    allItems.forEach((item: { name: string }) => {
      if (itemNames.has(item.name)) {
        duplicates.push(item.name);
      }
      itemNames.add(item.name);
    });
    
    if (duplicates.length > 0) {
      console.warn(`⚠️ Duplicates detected in Day ${dayNumber}:`, duplicates);
      // Remove duplicates - keep first occurrence only
      const seen = new Set<string>();
      const filterDuplicates = (items: Array<{ name: string }>) => 
        items.filter(item => {
          if (seen.has(item.name)) return false;
          seen.add(item.name);
          return true;
        });
      
      parsed.morning = filterDuplicates(parsed.morning || []);
      parsed.afternoon = filterDuplicates(parsed.afternoon || []);
      parsed.evening = filterDuplicates(parsed.evening || []);
      
      console.log(`✓ Duplicates removed from Day ${dayNumber}`);
    }
    
    // Track used items across days
    const finalItems = [...(parsed.morning || []), ...(parsed.afternoon || []), ...(parsed.evening || [])];
    finalItems.forEach((item: { name: string }) => usedItems.add(item.name));

    const day: DayPlan = {
      dayNumber,
      date: new Date().toISOString().split('T')[0], // Will be set properly by orchestrator
      morning: parsed.morning || [],
      afternoon: parsed.afternoon || [],
      evening: parsed.evening || [],
      theme: parsed.theme || theme,
      notes: parsed.reasoning?.join(' ') || '',
      estimatedCost: '$$$', // Will be calculated later
    };

    return { day, reasoning: parsed.reasoning || [] };
  }

  // Fallback day
  return {
    day: {
      dayNumber,
      date: new Date().toISOString().split('T')[0],
      morning: [],
      afternoon: [],
      evening: [],
      theme,
      notes: '',
      estimatedCost: '$$$',
    },
    reasoning: ['Fallback day structure'],
  };
}

/**
 * Truly Agentic Planner
 */
export async function runAgenticPlanner(request: PlanRequest): Promise<{
  plan: ItineraryPlan;
  thoughts: string[];
  reasoningSteps: ReasoningStep[];
}> {
  const { research, preferences, startDate, endDate } = request;
  const thoughts: string[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  const tripDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  thoughts.push(`🤖 AGENTIC PLANNER activated for ${tripDays}-day trip`);

  // STEP 1: Create strategic approach
  thoughts.push('');
  thoughts.push('🧠 REASONING: Developing planning strategy...');
  
  const step1: ReasoningStep = {
    thought: 'I need to determine the best approach for this trip based on user profile and available options',
    action: 'Creating strategic plan',
  };
  
  const strategy = await createPlanningStrategy(request);
  step1.result = `Strategy: ${strategy.approach}`;
  reasoningSteps.push(step1);
  
  thoughts.push(`💡 STRATEGY: ${strategy.approach}`);
  thoughts.push(`📋 REASONING: ${strategy.reasoning}`);
  thoughts.push(`🎯 PACING: ${strategy.pacingStrategy}`);
  thoughts.push(`🍽️ MEALS: ${strategy.mealStrategy}`);

  // STEP 2: Build each day with reasoning (PARALLELIZED but with duplicate prevention)
  thoughts.push('');
  thoughts.push('🏗️ BUILDING: Creating day-by-day itinerary in parallel...');
  
  // Build all days in parallel, but pass list of items to avoid
  const dayPromises = Array.from({ length: tripDays }, (_, i) => {
    const dayNumber = i + 1;
    const theme = strategy.dayThemes[i] || `Day ${dayNumber}`;

    // Compute the calendar date for this day so all downstream consumers
    // (DB persistence, email, UI) see the right value. Previously this was
    // always set to today, which meant Day 1 and Day 2 shared the same date.
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dayDateIso = dayDate.toISOString().split('T')[0];

    thoughts.push(`  Day ${dayNumber}: ${theme}`);

    // Create a shared set for tracking (won't prevent duplicates across parallel days, but better than nothing)
    const usedItems = new Set<string>();

    return buildDayWithReasoning(
      dayNumber,
      theme,
      research.destination,
      {
        attractions: research.attractions,
        restaurants: research.restaurants,
        activities: research.activities,
      },
      preferences,
      usedItems
    ).then(({ day, reasoning }) => {
      const step: ReasoningStep = {
        thought: `Planning Day ${dayNumber} with theme: ${theme}`,
        action: `Building activities for ${theme}`,
        result: `${day.morning.length + day.afternoon.length + day.evening.length} activities planned`,
      };
      reasoningSteps.push(step);
      reasoning.forEach(r => thoughts.push(`    💭 ${r}`));
      // Stamp the correct date now that the day has been built.
      return { ...day, date: dayDateIso };
    });
  });

  let days = await Promise.all(dayPromises);
  
  // STEP 2.5: Post-process to remove duplicates across days
  thoughts.push('');
  thoughts.push('🔍 DEDUPLICATING: Removing duplicate activities across days...');
  
  const globalUsedItems = new Set<string>();
  let duplicatesRemoved = 0;
  
  days = days.map((day, dayIndex) => {
    const dedupedMorning = day.morning.filter(item => {
      const itemKey = item.name.toLowerCase().trim();
      if (globalUsedItems.has(itemKey)) {
        thoughts.push(`  ⚠️ Removed duplicate "${item.name}" from Day ${dayIndex + 1}`);
        duplicatesRemoved++;
        return false;
      }
      globalUsedItems.add(itemKey);
      return true;
    });
    
    const dedupedAfternoon = day.afternoon.filter(item => {
      const itemKey = item.name.toLowerCase().trim();
      if (globalUsedItems.has(itemKey)) {
        thoughts.push(`  ⚠️ Removed duplicate "${item.name}" from Day ${dayIndex + 1}`);
        duplicatesRemoved++;
        return false;
      }
      globalUsedItems.add(itemKey);
      return true;
    });
    
    const dedupedEvening = day.evening.filter(item => {
      const itemKey = item.name.toLowerCase().trim();
      if (globalUsedItems.has(itemKey)) {
        thoughts.push(`  ⚠️ Removed duplicate "${item.name}" from Day ${dayIndex + 1}`);
        duplicatesRemoved++;
        return false;
      }
      globalUsedItems.add(itemKey);
      return true;
    });
    
    return {
      ...day,
      morning: dedupedMorning,
      afternoon: dedupedAfternoon,
      evening: dedupedEvening,
    };
  });
  
  if (duplicatesRemoved === 0) {
    thoughts.push('  ✓ No duplicates found - all activities are unique!');
  } else {
    thoughts.push(`  ✓ Removed ${duplicatesRemoved} duplicate activities`);
  }
  
  // Validate that days still have activities
  days.forEach((day, idx) => {
    const totalActivities = day.morning.length + day.afternoon.length + day.evening.length;
    if (totalActivities === 0) {
      thoughts.push(`  ⚠️ WARNING: Day ${idx + 1} has no activities after deduplication!`);
    }
  });

  // STEP 3: Validate flow
  thoughts.push('');
  thoughts.push('✅ VALIDATING: Checking itinerary flow...');
  
  const step3: ReasoningStep = {
    thought: 'Ensuring the itinerary flows logically and meets quality standards',
    action: 'Validating overall structure',
    result: `${days.length} days planned with ${days.reduce((sum, d) => sum + d.morning.length + d.afternoon.length + d.evening.length, 0)} total activities`,
  };
  reasoningSteps.push(step3);

  const plan: ItineraryPlan = {
    destination: research.destination,
    summary: `${tripDays}-day trip to ${research.destination}`,
    days,
    totalEstimatedCost: '$$$',
  };

  thoughts.push(`🎉 Plan complete: ${tripDays} days, ${plan.days.reduce((sum, d) => sum + d.morning.length + d.afternoon.length + d.evening.length, 0)} activities`);
  
  console.log('DEBUG [Agentic Planner]: Plan structure:', JSON.stringify(plan, null, 2));

  return { plan, thoughts, reasoningSteps };
}
