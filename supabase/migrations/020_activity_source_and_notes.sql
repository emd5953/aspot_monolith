-- 013/014 were written before the Spotz pivot (016) renamed activities -> plans
-- and were never applied to this database, so they still reference a table
-- name that no longer exists. Re-issued here against the current schema.
--
-- Provenance: where each plan came from in the research pipeline.
-- One of 'reddit' | 'places' | 'tavily' | 'ai' (see src/lib/ai/provenance.ts).
-- Nullable so pre-existing rows (and any path that can't determine a source)
-- simply carry no badge.
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN plans.source IS
  'Provenance of the pick: reddit | places | tavily | ai. Surfaced as a badge in the itinerary view.';

-- "Good to know" content the pipeline already produces but we used to drop.
-- Stored as JSONB string array, nullable so existing rows simply have none.
-- packing_tips is NOT added: the packing-tips concept was removed from the
-- product (Spotz plans a night out, not a trip) before this migration shipped.
ALTER TABLE itineraries
ADD COLUMN IF NOT EXISTS important_notes JSONB;

COMMENT ON COLUMN itineraries.important_notes IS 'string[] of important notes from the pipeline (cover, age limits, dress code, etc.)';
