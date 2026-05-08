import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateItinerary } from '@/lib/ai/itinerary-generator';
import { getPreferences } from '@/lib/preferences/preferences-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { destination, startDate, endDate, title, generationMode, activityDensity } = body;

    if (!destination || !startDate || !endDate) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Get user preferences
    const preferences = await getPreferences(supabase, user.id);
    if (!preferences) {
      return new Response('Please complete the quiz first', { status: 400 });
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: { status: string; message: string; progress?: number }) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          // Map generation mode to flags
          const mode = generationMode || 'standard';
          const useAgenticMode = true;
          const useTrulyAgentic = true;
          const useAdvancedCuration = mode === 'advanced';

          // Send initial progress
          sendProgress({ status: 'starting', message: 'Initializing itinerary generation...', progress: 0 });

          // Generate itinerary with progress callbacks
          const itinerary = await generateItinerary(
            supabase,
            {
              userId: user.id,
              destination,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              title,
              activityDensity: activityDensity || 'moderate',
            },
            preferences,
            useAgenticMode,
            useTrulyAgentic,
            useAdvancedCuration,
            // Progress callback
            (progressData) => {
              sendProgress(progressData);
            }
          );

          // Send completion
          sendProgress({ status: 'complete', message: 'Itinerary generated!', progress: 100 });
          
          // Send the final result
          const finalMessage = `data: ${JSON.stringify({ status: 'done', itinerary })}\n\n`;
          controller.enqueue(encoder.encode(finalMessage));
          
          controller.close();
        } catch (error) {
          console.error('Stream generation error:', error);
          const errorMessage = `data: ${JSON.stringify({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Failed to generate itinerary' 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generate itinerary stream error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Failed to generate itinerary',
      { status: 500 }
    );
  }
}
