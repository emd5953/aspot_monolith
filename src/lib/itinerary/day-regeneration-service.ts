import { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { UserPreferences } from '@/types/quiz';

interface RegenerateDayInput {
  itineraryId: string;
  dayId: string;
  dayNumber: number;
  date: Date;
  destination: string;
  userPrompt: string;
  preferences: UserPreferences;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  locationName?: string;
  category: string;
  estimatedCost?: number;
  sortOrder: number;
  notes?: string;
}

/**
 * Regenerate a single day based on user's natural language prompt
 */
export async function regenerateDay(
  supabase: SupabaseClient,
  input: RegenerateDayInput
): Promise<Activity[]> {
  const { itineraryId, dayId, dayNumber, date, destination, userPrompt, preferences } = input;

  // Get current activities for context
  const { data: currentActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order');

  const currentActivitiesText = currentActivities
    ?.map(a => `- ${a.title}: ${a.description}`)
    .join('\n') || 'No activities yet';

  // Build AI prompt
  const systemPrompt = `You are a travel planning AI. Generate activities for a single day of travel based on the user's request.

Destination: ${destination}
Day: ${dayNumber}
Date: ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

User Preferences:
- Activities: ${preferences.activityTypes.slice(0, 5).join(', ')}
- Cuisine: ${preferences.cuisinePreferences.slice(0, 3).join(', ')}
- Budget: ${preferences.budgetRange}
- Pace: ${preferences.travelPace}
- Interests: ${preferences.culturalInterests.slice(0, 3).join(', ')}

Current Activities:
${currentActivitiesText}

User's Request: "${userPrompt}"

Generate 3-6 activities for this day that match the user's request. Include specific location names/addresses so they can be shown on a map.

Return ONLY valid JSON in this exact format:
{
  "activities": [
    {
      "name": "Activity Name",
      "description": "Brief description",
      "locationName": "Specific address or location name",
      "category": "food|attraction|activity|shopping|entertainment|relaxation",
      "duration": 60,
      "estimatedCost": 25
    }
  ]
}`;

  console.log('[Day Regeneration] Calling AI with prompt:', userPrompt);
  const startTime = Date.now();

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: systemPrompt,
    temperature: 0.8,
  });

  console.log(`[Day Regeneration] AI completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Parse response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const newActivities = parsed.activities || [];

  if (newActivities.length === 0) {
    throw new Error('No activities generated');
  }

  // Delete old activities
  await supabase.from('activities').delete().eq('day_id', dayId);

  // Insert new activities
  const activitiesToInsert = newActivities.map((act: {
    name: string;
    description: string;
    locationName?: string;
    category: string;
    duration?: number;
    estimatedCost?: number;
  }, index: number) => ({
    day_id: dayId,
    title: act.name || 'Activity',
    description: act.description || '',
    location_name: act.locationName || act.name,
    category: act.category || 'activity',
    estimated_cost: act.estimatedCost || null,
    sort_order: index + 1,
    notes: `Regenerated based on: "${userPrompt}"`,
  }));

  const { data: insertedActivities, error: insertError } = await supabase
    .from('activities')
    .insert(activitiesToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to save activities: ${insertError.message}`);
  }

  // Update itinerary's updated_at timestamp
  await supabase
    .from('itineraries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', itineraryId);

  console.log(`[Day Regeneration] Successfully regenerated ${insertedActivities.length} activities`);

  return insertedActivities.map(act => ({
    id: act.id,
    title: act.title,
    description: act.description,
    locationName: act.location_name,
    category: act.category,
    estimatedCost: act.estimated_cost,
    sortOrder: act.sort_order,
    notes: act.notes,
  }));
}
