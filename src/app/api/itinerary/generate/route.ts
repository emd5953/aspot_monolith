import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { generateItinerary } from '@/lib/ai/itinerary-generator';
import { parsePrompt } from '@/lib/ai/parse-prompt';
import { sendItineraryEmail } from '@/lib/email/send-itinerary';
import { checkGenerationRateLimit } from '@/lib/ratelimit/generation';
import type { UserPreferences } from '@/types/profile';
import { defaultPreferencesFor } from '@/types/profile';
import type { GeneratedItinerary } from '@/lib/ai/itinerary-generator';
import type { SupabaseClient } from '@supabase/supabase-js';

type GenerationMode = 'fast' | 'deep';

interface RunOptions {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | undefined;
  destination: string;
  startDate: Date;
  endDate: Date;
  title?: string;
  activityDensity: 'relaxed' | 'moderate' | 'packed';
  preferences: UserPreferences;
  mode: GenerationMode;
  userIntent?: string;
  rawPrompt?: string;
}

/**
 * Run the full pipeline: generate itinerary + send the auto email afterward.
 * Used both in the awaited fast path and the fire-and-forget deep path.
 */
async function runGenerationPipeline(opts: RunOptions): Promise<GeneratedItinerary> {
  const itinerary = await generateItinerary(
    opts.supabase,
    {
      userId: opts.userId,
      destination: opts.destination,
      startDate: opts.startDate,
      endDate: opts.endDate,
      title: opts.title,
      activityDensity: opts.activityDensity,
      userIntent: opts.userIntent,
      rawPrompt: opts.rawPrompt,
    },
    opts.preferences,
    opts.mode === 'deep'
  );

  // Only deep mode emails the user. Fast mode keeps them on-screen, so an
  // email would be redundant.
  if (opts.mode === 'deep' && opts.userEmail) {
    try {
      await sendItineraryEmail({
        to: opts.userEmail,
        itineraryId: itinerary.id,
        title: itinerary.title,
        destination: itinerary.destination || opts.destination,
        startDate: itinerary.startDate,
        endDate: itinerary.endDate,
        // One night, one list. The email's day shape survives as a single
        // entry until the template itself is flattened.
        days: [
          {
            dayNumber: 1,
            date: itinerary.startDate,
            activities: (itinerary.plans ?? []).map((plan) => ({
              title: plan.name,
              locationName: undefined,
              startTime: undefined,
              endTime: undefined,
              category: plan.type,
            })),
          },
        ],
        importantNotes: itinerary.importantNotes,
      });
    } catch (err) {
      console.error('[email] Background send failed:', err);
    }
  }

  return itinerary;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit before any paid work — generation spends on OpenAI/Tavily.
    const rateLimit = await checkGenerationRateLimit(supabase, user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "You've reached the generation limit for now. Please try again a little later." },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    let {
      destination,
      startDate,
      endDate,
      title,
      activityDensity,
    }: {
      destination?: string;
      startDate?: string;
      endDate?: string;
      title?: string;
      activityDensity?: 'relaxed' | 'moderate' | 'packed';
    } = body;

    // Mode handling. Accept both new (`mode: 'fast'|'deep'`) and legacy
    // (`generationMode: 'standard'|'advanced'`) keys.
    const requestedMode: GenerationMode =
      body.mode === 'deep' || body.generationMode === 'advanced' ? 'deep' : 'fast';

    // One-shot prompt mode: the client sent a raw natural-language description.
    // Parse it into the structured fields the generator expects.
    let userIntent: string | undefined;
    let rawPrompt: string | undefined;
    if (!destination && typeof body.prompt === 'string' && body.prompt.trim()) {
      const trimmedPrompt = body.prompt.trim();
      rawPrompt = trimmedPrompt;
      const parsed = await parsePrompt(trimmedPrompt);
      destination = parsed.destination;
      startDate = parsed.startDate;
      endDate = parsed.endDate;
      title = title || parsed.title;
      activityDensity = activityDensity || parsed.activityDensity;
      userIntent = parsed.userIntent || undefined;
    }

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: destination, startDate, endDate' },
        { status: 400 }
      );
    }

    // Spotz has no quiz: every generation starts from the neutral default
    // profile and the prompt does all the steering.
    const preferences = defaultPreferencesFor(user.id);

    const runOpts: RunOptions = {
      supabase,
      userId: user.id,
      userEmail: user.email,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      title,
      activityDensity: activityDensity || 'moderate',
      preferences,
      mode: requestedMode,
      userIntent,
      rawPrompt,
    };

    if (requestedMode === 'fast') {
      // User is waiting on the response. Generate, return when ready.
      const itinerary = await runGenerationPipeline(runOpts);
      return NextResponse.json({ itinerary, mode: 'fast' });
    }

    // Deep mode: kick off generation in the background and respond immediately.
    // The user gets a "we'll email you" toast and is free to navigate away.
    // `waitUntil` keeps the serverless function alive until the promise resolves
    // (up to 5 min on Vercel hobby, 15 min on pro).
    waitUntil(
      runGenerationPipeline(runOpts).catch((err) =>
        console.error('[deep-mode] Generation failed:', err)
      )
    );

    return NextResponse.json({
      pending: true,
      mode: 'deep',
      message:
        "Got it — we're building a deeper itinerary. We'll email you when it's ready.",
    });
  } catch (error) {
    console.error('Generate itinerary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}
