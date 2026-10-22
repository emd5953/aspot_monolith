import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DiscoveryRequestSchema } from '@/lib/ai/schemas/discovery';
import { discoverConversation } from '@/lib/discovery/conversation';

/** First conversation adapter. No external messaging transport is configured. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.text();
    if (body.length > 16_000)
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = DiscoveryRequestSchema.safeParse(input);
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Send 1–12 messages, ending with a user message (up to 1000 characters each)' },
        { status: 400 }
      );
    const response = await discoverConversation(supabase, parsed.data);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[discovery] failed:', error);
    return NextResponse.json({ error: 'Discovery is temporarily unavailable' }, { status: 503 });
  }
}
