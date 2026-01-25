-- Fix infinite recursion in trip_members policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Trip members can view other members" ON public.trip_members;

-- Create a simpler policy that allows users to see members of trips they're in
-- This uses a direct check against the trips table instead of recursing into trip_members
CREATE POLICY "Trip members can view other members" ON public.trip_members
  FOR SELECT USING (
    -- User can see members if they are the organizer of the trip
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_members.trip_id AND t.organizer_id = auth.uid()
    )
    OR
    -- User can see members if they are a member themselves (direct check, no recursion)
    trip_members.user_id = auth.uid()
  );

-- Alternative: If you need users to see ALL members of trips they're in,
-- you'll need to use a security definer function to break the recursion
-- For now, this allows:
-- 1. Organizers to see all members
-- 2. Members to see themselves
-- 3. When listing members, the app can use the organizer's permissions
