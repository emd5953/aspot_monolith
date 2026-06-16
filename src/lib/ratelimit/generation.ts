/**
 * Per-user rate limit for itinerary generation.
 *
 * Generation triggers paid OpenAI/Tavily work, so we cap it per user over a
 * rolling window. The decision math is pure (and unit-tested); the Supabase
 * wrapper records events in `generation_events` and FAILS OPEN — a missing
 * table/migration or a transient query error must never block a real user.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

/** 10 generations per rolling hour, per user. */
export const GENERATION_RATE_LIMIT: RateLimitOptions = {
  max: 10,
  windowMs: 60 * 60 * 1000,
};

export interface RateLimitDecision {
  allowed: boolean;
  /** Remaining generations in the window after this one (0 when blocked). */
  remaining: number;
  /** Seconds until the next generation would be allowed (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * Pure decision: given the user's prior generation timestamps (ms), decide
 * whether one more is allowed right now.
 */
export function checkRateLimit(
  timestamps: number[],
  now: number,
  opts: RateLimitOptions = GENERATION_RATE_LIMIT
): RateLimitDecision {
  const windowStart = now - opts.windowMs;
  const inWindow = timestamps.filter((t) => t > windowStart).sort((a, b) => a - b);

  if (inWindow.length < opts.max) {
    return {
      allowed: true,
      remaining: opts.max - inWindow.length - 1,
      retryAfterSeconds: 0,
    };
  }

  // At the cap — the oldest in-window event has to age out before the next slot.
  const oldest = inWindow[0];
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/**
 * Check (and, when allowed, record) a generation for `userId`. Fails open on any
 * storage error so generation is never blocked by a missing migration.
 */
export async function checkGenerationRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitDecision> {
  const windowStartIso = new Date(Date.now() - GENERATION_RATE_LIMIT.windowMs).toISOString();

  const { data, error } = await supabase
    .from('generation_events')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStartIso);

  if (error) {
    console.warn('[ratelimit] check failed — allowing (apply migration 015):', error.message);
    return { allowed: true, remaining: GENERATION_RATE_LIMIT.max, retryAfterSeconds: 0 };
  }

  const timestamps = (data ?? []).map((r) => new Date(r.created_at as string).getTime());
  const decision = checkRateLimit(timestamps, Date.now());

  if (decision.allowed) {
    const { error: insertError } = await supabase
      .from('generation_events')
      .insert({ user_id: userId });
    if (insertError) {
      console.warn('[ratelimit] failed to record generation:', insertError.message);
    }
  }

  return decision;
}
