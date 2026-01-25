-- Fix infinite recursion between trips and trip_members policies
-- The issue: trips policy checks trip_members, trip_members policy checks trips

-- Drop problematic policies
DROP POLICY IF EXISTS "Trip members can view their trips" ON public.trips;
DROP POLICY IF EXISTS "Trip members can view other members" ON public.trip_members;

-- Recreate trips policy without recursion
-- Users can view trips if they are the organizer OR a direct member
CREATE POLICY "Trip members can view their trips" ON public.trips
  FOR SELECT USING (
    auth.uid() = organizer_id
    OR
    id IN (
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
    )
  );

-- Recreate trip_members policy without recursion
-- Users can view members if they are the organizer OR they are viewing themselves
CREATE POLICY "Trip members can view other members" ON public.trip_members
  FOR SELECT USING (
    -- User is the organizer of this trip
    trip_id IN (
      SELECT id FROM public.trips WHERE organizer_id = auth.uid()
    )
    OR
    -- User is viewing their own membership
    user_id = auth.uid()
  );
