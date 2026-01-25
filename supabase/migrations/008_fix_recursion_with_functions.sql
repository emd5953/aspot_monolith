-- Fix infinite recursion using security definer functions
-- This breaks the circular dependency between trips and trip_members

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Trip members can view their trips" ON public.trips;
DROP POLICY IF EXISTS "Trip members can view other members" ON public.trip_members;

-- Create a security definer function to check if user is a trip member
-- This function runs with elevated privileges and doesn't trigger RLS
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.trip_members 
    WHERE trip_id = trip_id_param AND user_id = user_id_param
  );
$$;

-- Create a security definer function to check if user is trip organizer
CREATE OR REPLACE FUNCTION public.is_trip_organizer(trip_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.trips 
    WHERE id = trip_id_param AND organizer_id = user_id_param
  );
$$;

-- Recreate trips policy using the security definer function
CREATE POLICY "Trip members can view their trips" ON public.trips
  FOR SELECT USING (
    auth.uid() = organizer_id
    OR
    public.is_trip_member(id, auth.uid())
  );

-- Recreate trip_members policy using the security definer function
CREATE POLICY "Trip members can view other members" ON public.trip_members
  FOR SELECT USING (
    public.is_trip_organizer(trip_id, auth.uid())
    OR
    user_id = auth.uid()
  );

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_organizer(uuid, uuid) TO authenticated;
