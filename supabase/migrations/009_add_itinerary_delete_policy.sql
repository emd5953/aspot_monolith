-- Add DELETE policy for itineraries table
CREATE POLICY "Users can delete their own itineraries" ON public.itineraries
  FOR DELETE USING (auth.uid() = user_id);
