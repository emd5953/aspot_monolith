-- ============================================================
-- Spotz pivot: combined migrations 016-018, for the Supabase
-- Dashboard SQL Editor. Wrapped in a transaction — if anything
-- fails, nothing is applied.
--
-- ⚠️  DESTRUCTIVE: drops trips/quiz/collab/preferences tables and
-- all their data (rsvps, votes, suggestions, notifications,
-- notification_preferences, trip_members, trips, quiz_progress,
-- user_preferences). Back up first if you need that data.
-- ============================================================

BEGIN;

-- ---------- 016_spotz_pivot.sql ----------

-- 1) Drop collab + quiz tables (dependency order)
DROP TABLE IF EXISTS public.rsvps CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.trip_members CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.quiz_progress CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;

-- 2) Rename activities -> plans (a "plan" is one stop in the Move-list)
ALTER TABLE public.activities RENAME TO plans;

-- 3) Itineraries: Spotz fields + one-active-per-user
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS vibe_prompt TEXT,
  ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;

-- A Spotz itinerary is one night/day out; start_date == end_date by convention.
-- One active itinerary per user (history rows are 'archived').
CREATE UNIQUE INDEX IF NOT EXISTS one_active_itinerary_per_user
  ON public.itineraries (user_id)
  WHERE status = 'active';

-- ---------- 017_candidate_events.sql ----------

-- Candidate events pool: the "what's happening in NYC" store.
-- Populated by scheduled source connectors (posh, luma, partiful, tiktok, places).
-- Generation reads from this pool; it never fetches sources live.

CREATE TABLE public.candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('posh', 'luma', 'partiful', 'tiktok', 'places', 'manual')),
  source_id TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  venue_name TEXT,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT FALSE,
  hype JSONB DEFAULT '{}',          -- guest_count, ticket_count, etc. per source
  tags TEXT[] DEFAULT '{}',          -- vibe tags from normalization
  raw JSONB NOT NULL,                -- full source payload (provenance)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,            -- usually ends_at; pool GC uses this
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

CREATE INDEX idx_candidate_events_starts_at ON public.candidate_events (starts_at);
CREATE INDEX idx_candidate_events_expires_at ON public.candidate_events (expires_at);
CREATE INDEX idx_candidate_events_geo ON public.candidate_events (lat, lng);

-- Service-role writes only (ingestion runs server-side); authenticated users read.
ALTER TABLE public.candidate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_events_read" ON public.candidate_events
  FOR SELECT TO authenticated USING (true);

-- ---------- 018_shares_votes.sql ----------

-- Share links + lightweight votes (👍/👎) on plans.
-- Share model: itineraries.share_code (016) makes an itinerary viewable+votable
-- by any authenticated user who has the link. Votes are reactions, not governance.

CREATE TABLE public.plan_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id, user_id)
);

CREATE INDEX idx_plan_votes_plan ON public.plan_votes (plan_id);

ALTER TABLE public.plan_votes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read votes (shared itineraries need vote counts).
CREATE POLICY "plan_votes_read" ON public.plan_votes
  FOR SELECT TO authenticated USING (true);

-- Users manage their own votes.
CREATE POLICY "plan_votes_insert" ON public.plan_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plan_votes_update" ON public.plan_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "plan_votes_delete" ON public.plan_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Live thumbs: realtime on votes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_votes;

-- Shared itineraries: any authenticated user may READ an itinerary (and its
-- days/plans) once the owner minted a share code. Votes need the same read
-- reach. Mutations remain owner-only via the existing policies.
CREATE POLICY "itineraries_shared_read" ON public.itineraries
  FOR SELECT TO authenticated
  USING (share_code IS NOT NULL);

CREATE POLICY "itinerary_days_shared_read" ON public.itinerary_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_days.itinerary_id AND i.share_code IS NOT NULL
    )
  );

CREATE POLICY "plans_shared_read" ON public.plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = plans.day_id AND i.share_code IS NOT NULL
    )
  );

COMMIT;
