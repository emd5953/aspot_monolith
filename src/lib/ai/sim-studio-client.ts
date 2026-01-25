/**
 * Sim Studio Client
 * 
 * Sim Studio is a visual AI agent workflow builder.
 * You create workflows by connecting blocks on a canvas:
 * - Input blocks (user preferences, destination)
 * - AI blocks (LLM reasoning, Firecrawl scraping)
 * - Logic blocks (conditions, loops)
 * - Output blocks (structured itinerary)
 * 
 * Once deployed, Sim gives you an API endpoint to trigger the workflow.
 * This client calls that endpoint from our Next.js app.
 * 
 * Setup:
 * 1. Go to simstudio.ai and create your workflow
 * 2. Deploy it and get your workflow ID + API key
 * 3. Add to .env.local:
 *    SIM_API_KEY=your-sim-api-key
 *    SIM_WORKFLOW_ID=your-workflow-id
 */

import { UserPreferences } from '@/types/quiz';

const SIM_API_KEY = process.env.SIM_API_KEY;
const SIM_WORKFLOW_ID = process.env.SIM_WORKFLOW_ID;
const SIM_API_BASE = 'https://api.simstudio.ai/v1';

export interface SimWorkflowInput {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: UserPreferences;
}

export interface SimItineraryDay {
  dayNumber: number;
  date: string;
  activities: SimActivity[];
  notes?: string;
}

export interface SimActivity {
  title: string;
  description: string;
  category: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  duration: number;
  location?: string;
  priceRange?: string;
  matchScore?: number;
  matchReasons?: string[];
}

export interface SimWorkflowOutput {
  success: boolean;
  itinerary?: {
    destination: string;
    days: SimItineraryDay[];
    tips: string[];
    totalEstimatedCost?: string;
  };
  error?: string;
  executionId?: string;
}

/**
 * Execute a Sim Studio workflow
 * This triggers your deployed AI agent workflow
 */
export async function executeSimWorkflow(
  input: SimWorkflowInput
): Promise<SimWorkflowOutput> {
  if (!SIM_API_KEY || SIM_API_KEY === 'your-sim-api-key') {
    console.warn('SIM_API_KEY not configured, using fallback generation');
    return generateFallbackItinerary(input);
  }

  if (!SIM_WORKFLOW_ID || SIM_WORKFLOW_ID === 'your-workflow-id') {
    console.warn('SIM_WORKFLOW_ID not configured, using fallback generation');
    return generateFallbackItinerary(input);
  }

  try {
    const response = await fetch(`${SIM_API_BASE}/workflows/${SIM_WORKFLOW_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SIM_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: {
          destination: input.destination,
          start_date: input.startDate,
          end_date: input.endDate,
          budget: input.preferences.budgetRange,
          travel_pace: input.preferences.travelPace,
          activity_types: input.preferences.activityTypes,
          cuisine_preferences: input.preferences.cuisinePreferences,
          planning_style: input.preferences.planningStyle,
          comfort_zone: input.preferences.comfortZone,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sim API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      itinerary: result.outputs?.itinerary,
      executionId: result.execution_id,
    };
  } catch (error) {
    console.error('Sim workflow execution failed:', error);
    
    // Fallback to local generation if Sim fails
    return generateFallbackItinerary(input);
  }
}

/**
 * Check the status of a running workflow
 * Useful for long-running agent tasks
 */
export async function getWorkflowStatus(executionId: string): Promise<{
  status: 'running' | 'completed' | 'failed';
  output?: SimWorkflowOutput;
}> {
  if (!SIM_API_KEY || !SIM_WORKFLOW_ID) {
    return { status: 'failed' };
  }

  try {
    const response = await fetch(
      `${SIM_API_BASE}/workflows/${SIM_WORKFLOW_ID}/executions/${executionId}`,
      {
        headers: {
          'Authorization': `Bearer ${SIM_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status,
      output: result.status === 'completed' ? result.outputs : undefined,
    };
  } catch (error) {
    console.error('Failed to get workflow status:', error);
    return { status: 'failed' };
  }
}

/**
 * Fallback itinerary generation when Sim is not configured
 * This uses simple logic instead of AI agents
 */
function generateFallbackItinerary(input: SimWorkflowInput): SimWorkflowOutput {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const tripDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const days: SimItineraryDay[] = [];

  for (let i = 0; i < tripDuration; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);

    const activities: SimActivity[] = [
      {
        title: `Explore ${input.destination} - Day ${i + 1}`,
        description: `Discover the highlights of ${input.destination}`,
        category: 'sightseeing',
        timeSlot: 'morning',
        duration: 120,
        matchReasons: ['Popular attraction'],
      },
      {
        title: `Local Lunch in ${input.destination}`,
        description: 'Try local cuisine at a recommended restaurant',
        category: 'dining',
        timeSlot: 'afternoon',
        duration: 90,
        priceRange: input.preferences.budgetRange,
        matchReasons: ['Matches your cuisine preferences'],
      },
    ];

    // Add more activities based on pace
    if (input.preferences.travelPace !== 'relaxed') {
      activities.push({
        title: `Evening Activity in ${input.destination}`,
        description: 'Wind down with an evening experience',
        category: input.preferences.activityTypes[0] || 'local',
        timeSlot: 'evening',
        duration: 120,
        matchReasons: ['Matches your interests'],
      });
    }

    days.push({
      dayNumber: i + 1,
      date: dayDate.toISOString().split('T')[0],
      activities,
      notes: i === 0 ? 'Arrival day - take it easy!' : undefined,
    });
  }

  return {
    success: true,
    itinerary: {
      destination: input.destination,
      days,
      tips: [
        `Best time to visit ${input.destination} varies by season`,
        'Book popular attractions in advance',
        'Learn a few local phrases',
      ],
    },
  };
}
