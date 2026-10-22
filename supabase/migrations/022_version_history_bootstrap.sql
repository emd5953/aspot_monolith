-- 001 creates itinerary_versions with changed_by, so 005's CREATE TABLE IF NOT
-- EXISTS never adds created_by on a fresh install. The application writes and
-- reads created_by. Preserve existing authors while adding the missing field.
ALTER TABLE public.itinerary_versions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

UPDATE public.itinerary_versions
SET created_by = changed_by
WHERE created_by IS NULL AND changed_by IS NOT NULL;

-- 016's DROP TABLE ... CASCADE removes 005's SELECT policy because it also
-- referenced the old trips tables. Restore the current owner-only contract.
DROP POLICY IF EXISTS "Users can view versions of their itineraries"
  ON public.itinerary_versions;
CREATE POLICY "Users can view versions of their itineraries"
  ON public.itinerary_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_versions.itinerary_id AND i.user_id = auth.uid()
    )
  );
