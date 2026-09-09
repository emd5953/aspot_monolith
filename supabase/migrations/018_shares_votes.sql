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
