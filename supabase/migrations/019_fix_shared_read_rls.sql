-- ============================================================
-- 019: close the shared-read RLS hole opened in 018.
--
-- 018 granted every authenticated user SELECT on any itinerary
-- whose share_code IS NOT NULL (and, transitively, its days and
-- plans). The predicate never checked WHICH code the caller
-- holds, so the share code stopped being a secret: anyone signed
-- in could read every shared itinerary with the public anon key.
--
-- Shared reads now go through the service role in
-- /api/shared/[code] and /s/[code], where knowing the code IS the
-- capability. RLS goes back to owner-only.
-- ============================================================

DROP POLICY IF EXISTS "itineraries_shared_read" ON public.itineraries;
DROP POLICY IF EXISTS "itinerary_days_shared_read" ON public.itinerary_days;
DROP POLICY IF EXISTS "plans_shared_read" ON public.plans;

-- plan_votes_read was equally broad ("anyone authenticated can read votes").
-- Vote tallies for a shared itinerary are served by the same service-role
-- path, so regular users only need to see their own votes.
DROP POLICY IF EXISTS "plan_votes_read" ON public.plan_votes;

CREATE POLICY "plan_votes_read_own" ON public.plan_votes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
