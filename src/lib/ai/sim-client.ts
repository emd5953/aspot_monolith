/**
 * Sim Studio Client
 * 
 * Calls your deployed Sim Studio workflows via API.
 * 
 * Setup:
 * 1. Build your itinerary workflow in Sim Studio canvas
 * 2. Deploy it and copy the workflow_id
 * 3. Add SIM_API_KEY and SIM_WORKFLOW_ID to .env.local
 * 4. This client calls your workflow programmatically
 * 
 * Your Sim workflow should:
 * - Accept: { destination, preferences, duration }
 * - Use Firecrawl block to scrape destination data
 * - Use AI/Agent block to generate recommendations
 * - Return: { attractions, restaurants, activities, dayPlans }
 */

const SIM_API_KEY = process.env.SIM_API_KEY;
const SIM_API_URL = process.env.SIM_API_URL || 'https://sim.ai/api';
const SIM_ITINERARY_WORKFLOW_ID = process.env.SIM_ITINERARY_WORKFLOW_ID;

export interface SimWorkflowInput {
  destination: string;
  preferences: {
    cuisinePreferences: string[];
    activityTypes: string[];
    budgetRange: string;
    travelPace: string;
    adventureTolerance: number;
  };
  duration: number;
  startDate: string;
}

export interface SimWorkflowOutput {
  success: boolean;
  output?: {
    attractions: Array<{
      name: string;
      description: string;
      category: string;
      address: string;
      estimatedDuration: number;
      priceRange: string;
      rating?: number;
    }>;
    restaurants: Array<{
      name: string;
      cuisine: string[];
      priceRange: string;
      address: string;
      rating?: number;
    }>;
    activities: Array<{
      name: string;
      description: string;
      category: string;
      duration: number;
      priceRange: string;
      adventureLevel: number;
    }>;
    dayPlans: Array<{
      dayNumber: number;
      activities: Array<{
        name: string;
        timeSlot: 'morning' | 'afternoon' | 'evening';
        duration: number;
        type: 'attraction' | 'restaurant' | 'activity';
      }>;
      notes: string;
    }>;
  };
  error?: string;
}

/**
 * Execute a Sim Studio workflow
 */
export async function executeSimWorkflow(
  workflowId: string,
  input: Record<string, unknown>
): Promise<SimWorkflowOutput> {
  if (!SIM_API_KEY || SIM_API_KEY === 'your-sim-api-key') {
    console.warn('SIM_API_KEY not configured, using fallback');
    return { success: false, error: 'SIM_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${SIM_API_URL}/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SIM_API_KEY,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sim API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: result.success ?? true,
      output: result.output,
      error: result.error,
    };
  } catch (error) {
    console.error('Sim workflow execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute the itinerary generation workflow
 * This is the main function your app calls
 */
export async function executeItineraryWorkflow(
  input: SimWorkflowInput
): Promise<SimWorkflowOutput> {
  if (!SIM_ITINERARY_WORKFLOW_ID) {
    console.warn('SIM_ITINERARY_WORKFLOW_ID not configured');
    return { success: false, error: 'Workflow ID not configured' };
  }

  return executeSimWorkflow(SIM_ITINERARY_WORKFLOW_ID, input);
}

/**
 * Check if Sim Studio is properly configured
 */
export function isSimConfigured(): boolean {
  return !!(
    SIM_API_KEY &&
    SIM_API_KEY !== 'your-sim-api-key' &&
    SIM_ITINERARY_WORKFLOW_ID
  );
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(workflowId: string): Promise<{
  deployed: boolean;
  error?: string;
}> {
  if (!SIM_API_KEY) {
    return { deployed: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(`${SIM_API_URL}/workflows/${workflowId}/status`, {
      headers: {
        'X-API-Key': SIM_API_KEY,
      },
    });

    if (!response.ok) {
      return { deployed: false, error: `Status check failed: ${response.status}` };
    }

    const data = await response.json();
    return { deployed: data.deployed ?? false };
  } catch (error) {
    return {
      deployed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
