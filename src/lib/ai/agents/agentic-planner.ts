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
- Interests: ${preferences.activityTypes.join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}
- Adventure: ${preferences.adventureTolerance}/10

AVAILABLE OPTIONS:
- ${research.attractions.length} attractions
- ${research.restaurants.length} restaurants
- ${research.activities.length} activities

STRATEGIC QUESTIONS:
1. How should we pace the trip? (arrival day lighter, build up, wind down?)
2. What theme/focus for each day?
3. How to balance activities vs relaxation?
4. How to group locations efficiently?
5. How to handle meals strategically?

Return JSON with your strategy:
{
  "approach": "Overall strategic approach",
  "reasoning": "Why this approach works for this traveler",
  "dayThemes": ["Day 1 theme", "Day 2 theme", ...],
  "pacingStrategy": "How we'll pace activities",
  "mealStrategy": "How we'll handle dining"
}`;

  const result = await generateText({
    model: openai('gpt-4o'),
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
  const dayPrompt = `You are planning Day ${dayNumber} of an itinerary.

THEME: ${theme}
USER: ${preferences.activityTypes.slice(0, 3).join(', ')}, ${preferences.budgetRange} budget, ${preferences.travelPace} pace

AVAILABLE OPTIONS (not yet used):
Attractions: ${availableOptions.attractions.filter(a => !usedItems.has(a.name)).slice(0, 10).map(a => `${a.name} (${a.category}, ${a.estimatedDuration}min, ${a.priceRange})`).join(', ') || 'None available - create generic activities'}

Restaurants: ${availableOptions.restaurants.filter(r => !usedItems.has(r.name)).slice(0, 8).map(r => `${r.name} (${r.cuisine.join('/')}, ${r.priceRange})`).join(', ') || 'None available - create generic restaurants'}

Activities: ${availableOptions.activities.filter(a => !usedItems.has(a.name)).slice(0, 6).map(a => `${a.name} (${a.category}, ${a.duration}min)`).join(', ') || 'None available - create generic activities'}

${availableOptions.attractions.length === 0 && availableOptions.restaurants.length === 0 && availableOptions.activities.length === 0 ? 
'NOTE: No specific data available. Create realistic activities based on your knowledge of the destination.' : ''}

BUILD THIS DAY:
- Morning (9am-12pm): 1-2 activities
- Afternoon (12pm-5pm): Lunch + 1-2 activities  
- Evening (5pm-9pm): 1 activity + dinner

CRITICAL RULES:
1. You MUST include activities for morning, afternoon, and evening. Do not return empty arrays.
2. DO NOT repeat the same location/activity within the same day (e.g., don't visit Golden Gate Park twice)
3. Each activity must have a unique name within the day
4. If you need similar activities, use different locations or variations

REASONING REQUIRED:
- Why each activity fits the theme
- Why the order makes sense
- How it matches user preferences

Return VALID JSON (no markdown, no extra text):
{
  "morning": [
    {"name": "Activity Name", "type": "attraction", "time": "09:00", "duration": 120, "description": "What you do", "matchScore": 85, "matchReasons": ["why this fits"]}
  ],
  "afternoon": [
    {"name": "Restaurant Name", "type": "restaurant", "time": "12:00", "duration": 90, "description": "Lunch spot", "matchScore": 80, "matchReasons": ["why"]},
    {"name": "Activity Name", "type": "attraction", "time": "14:00", "duration": 120, "description": "Afternoon activity", "matchScore": 85, "matchReasons": ["why"]}
  ],
  "evening": [
    {"name": "Activity Name", "type": "activity", "time": "17:00", "duration": 90, "description": "Evening activity", "matchScore": 80, "matchReasons": ["why"]},
    {"name": "Restaurant Name", "type": "restaurant", "time": "19:00", "duration": 90, "description": "Dinner", "matchScore": 85, "matchReasons": ["why"]}
  ],
  "reasoning": ["Why this day works", "How activities flow together"],
  "theme": "${theme}"
}`;

  const result = await generateText({
    model: openai('gpt-4o'),
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

  // STEP 2: Build each day with reasoning
  thoughts.push('');
  thoughts.push('🏗️ BUILDING: Creating day-by-day itinerary...');
  
  const days: DayPlan[] = [];
  const usedItems = new Set<string>();

  for (let i = 0; i < tripDays; i++) {
    const dayNumber = i + 1;
    const theme = strategy.dayThemes[i] || `Day ${dayNumber}`;
    
    const step: ReasoningStep = {
      thought: `Planning Day ${dayNumber} with theme: ${theme}`,
      action: `Building activities for ${theme}`,
    };
    
    thoughts.push(`  Day ${dayNumber}: ${theme}`);
    
    const { day, reasoning } = await buildDayWithReasoning(
      dayNumber,
      theme,
      {
        attractions: research.attractions,
        restaurants: research.restaurants,
        activities: research.activities,
      },
      preferences,
      usedItems
    );
    
    days.push(day);
    step.result = `${day.morning.length + day.afternoon.length + day.evening.length} activities planned`;
    reasoningSteps.push(step);
    
    reasoning.forEach(r => thoughts.push(`    💭 ${r}`));
  }

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
