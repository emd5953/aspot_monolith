-- Per-user itinerary-generation events, for rate limiting the paid generation
-- endpoints (see src/lib/ratelimit/generation.ts). One row per generation.
CREATE TABLE IF NOT EXISTS public.generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The limiter queries recent events per user, ordered by time.
CREATE INDEX IF NOT EXISTS idx_generation_events_user_time
  ON public.generation_events (user_id, created_at DESC);

ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own generation events" ON public.generation_events;
CREATE POLICY "Users can view their own generation events"
  ON public.generation_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own generation events" ON public.generation_events;
CREATE POLICY "Users can insert their own generation events"
  ON public.generation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
