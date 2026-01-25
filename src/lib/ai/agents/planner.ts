/**
 * Planner Agent
 * 
 * Specialized agent for creating day-by-day itineraries.
 * Takes research data and user preferences to build optimized schedules.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PlanRequest, ItineraryPlan, DayPlan, ScheduledItem } from './types';

/**
 * Planner Agent - creates structured itineraries
 */
export async function runPlannerAgent(request: PlanRequest): Promise<{
  plan: ItineraryPlan;
  thoughts: string[];
}> {
  const { research, preferences, startDate, endDate } = request;
  const thoughts: string[] = [];

  const tripDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  thoughts.push(`Planning ${tripDuration}-day trip to ${research.destination}`);
  thoughts.push(`Available: ${research.attractions.length} attractions, ${research.restaurants.length} restaurants, ${research.activities.length} activities`);

  // Determine activities per day based on pace
  const activitiesPerDay = {
    relaxed: { morning: 1, afternoon: 1, evening: 1 },
    moderate: { morning: 1, afternoon: 2, evening: 1 },
    packed: { morning: 2, afternoon: 2, evening: 2 },
  }[preferences.travelPace] || { morning: 1, afternoon: 2, evening: 1 };

  thoughts.push(`Travel pace: ${preferences.travelPace} - planning ${Object.values(activitiesPerDay).reduce((a, b) => a + b, 0)} activities per day`);

  // Build the planning prompt
  const planningPrompt = `You are an expert travel planner creating a ${tripDuration}-day itinerary for ${research.destination}.

AVAILABLE OPTIONS:
ATTRACTIONS:
${research.attractions.map(a => `- ${a.name} (${a.category}, ${a.estimatedDuration}min, ${a.priceRange}) ${a.tips ? `Tip: ${a.tips}` : ''}`).join('\n')}

RESTAURANTS:
${research.restaurants.map(r => `- ${r.name} (${r.cuisine.join('/')}, ${r.priceRange}) ${r.mustTry ? `Must try: ${r.mustTry}` : ''}`).join('\n')}

ACTIVITIES:
${research.activities.map(a => `- ${a.name} (${a.category}, ${a.duration}min, adventure: ${a.adventureLevel}/10, best: ${a.bestTime || 'anytime'})`).join('\n')}

USER PREFERENCES:
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace} (${activitiesPerDay.morning} morning, ${activitiesPerDay.afternoon} afternoon, ${activitiesPerDay.evening} evening activities)
- Interests: ${preferences.activityTypes.join(', ')}
- Cuisines: ${preferences.cuisinePreferences.join(', ')}
- Adventure level: ${preferences.adventureTolerance}/10

LOCAL INSIGHTS:
${research.localInsights.map(i => `- ${i}`).join('\n')}

RULES:
1. Day 1 should be lighter (arrival day)
2. Don't repeat attractions/activities
3. Include lunch and dinner restaurants each day
4. Match adventure level to user preference
5. Group nearby attractions together
6. Leave free time for spontaneous exploration
7. Consider opening hours (museums morning, nightlife evening)

Create a detailed ${tripDuration}-day itinerary. For each day, provide:
- A theme for the day
- Morning activities (starting ~9am)
- Afternoon activities (including lunch ~12-1pm)
- Evening activities (including dinner ~7pm)
- Practical notes

RESPOND WITH VALID JSON:
{
  "summary": "Brief trip overview",
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate.toISOString().split('T')[0]}",
      "theme": "Arrival & City Introduction",
      "morning": [{"time": "09:00", "name": "", "type": "attraction", "duration": 90, "description": "", "tips": ""}],
      "afternoon": [{"time": "12:00", "name": "", "type": "restaurant", "duration": 60}],
      "evening": [{"time": "19:00", "name": "", "type": "restaurant", "duration": 90}],
      "notes": "",
      "estimatedCost": "$50-80"
    }
  ],
  "totalEstimatedCost": "$XXX-XXX",
  "packingTips": [""],
  "importantNotes": [""]
}`;

  try {
    thoughts.push('Generating optimized itinerary...');

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: planningPrompt,
      temperature: 0.8,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and structure the plan
      const days: DayPlan[] = (parsed.days || []).map((day: Partial<DayPlan>, index: number) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + index);

        return {
          dayNumber: day.dayNumber || index + 1,
          date: dayDate.toISOString().split('T')[0],
          theme: day.theme || `Day ${index + 1}`,
          morning: validateScheduledItems(day.morning || []),
          afternoon: validateScheduledItems(day.afternoon || []),
          evening: validateScheduledItems(day.evening || []),
          notes: day.notes || '',
          estimatedCost: day.estimatedCost || 'Varies',
        };
      });

      // Ensure we have all days
      while (days.length < tripDuration) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + days.length);
        days.push(createDefaultDay(days.length + 1, dayDate, research));
      }

      const plan: ItineraryPlan = {
        destination: research.destination,
        summary: parsed.summary || `${tripDuration}-day adventure in ${research.destination}`,
        days,
        totalEstimatedCost: parsed.totalEstimatedCost || 'Varies by choices',
        packingTips: parsed.packingTips || [],
        importantNotes: parsed.importantNotes || [],
      };

      thoughts.push(`Created ${days.length}-day itinerary with ${days.reduce((sum, d) => sum + d.morning.length + d.afternoon.length + d.evening.length, 0)} total activities`);
      thoughts.push('Planning complete!');

      return { plan, thoughts };
    }
  } catch (error) {
    thoughts.push(`Planning error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fallback plan
  thoughts.push('Using fallback planning...');
  return {
    plan: createFallbackPlan(research, tripDuration, startDate),
    thoughts,
  };
}

function validateScheduledItems(items: Partial<ScheduledItem>[]): ScheduledItem[] {
  return items.map(item => ({
    time: item.time || '10:00',
    name: item.name || 'Activity',
    type: item.type || 'activity',
    duration: item.duration || 60,
    description: item.description,
    tips: item.tips,
  }));
}

function createDefaultDay(dayNumber: number, date: Date, research: { destination: string; attractions: { name: string }[]; restaurants: { name: string }[] }): DayPlan {
  return {
    dayNumber,
    date: date.toISOString().split('T')[0],
    theme: `Exploring ${research.destination}`,
    morning: [{ time: '09:00', name: research.attractions[0]?.name || 'Morning exploration', type: 'attraction', duration: 120 }],
    afternoon: [
      { time: '12:30', name: research.restaurants[0]?.name || 'Local lunch', type: 'restaurant', duration: 60 },
      { time: '14:00', name: 'Free time to explore', type: 'free_time', duration: 120 },
    ],
    evening: [{ time: '19:00', name: research.restaurants[1]?.name || 'Dinner', type: 'restaurant', duration: 90 }],
    notes: '',
    estimatedCost: 'Varies',
  };
}

function createFallbackPlan(research: { destination: string; attractions: { name: string }[]; restaurants: { name: string }[] }, tripDuration: number, startDate: Date): ItineraryPlan {
  const days: DayPlan[] = [];
  
  for (let i = 0; i < tripDuration; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);
    days.push(createDefaultDay(i + 1, dayDate, research));
  }

  return {
    destination: research.destination,
    summary: `${tripDuration}-day trip to ${research.destination}`,
    days,
    totalEstimatedCost: 'Varies',
    packingTips: ['Pack comfortable walking shoes', 'Bring a reusable water bottle'],
    importantNotes: ['Check opening hours before visiting attractions'],
  };
}
