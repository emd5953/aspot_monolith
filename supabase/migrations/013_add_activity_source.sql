-- Provenance: where each activity came from in the research pipeline.
-- One of 'reddit' | 'places' | 'tavily' | 'ai' (see src/lib/ai/provenance.ts).
-- Nullable so pre-existing rows (and any path that can't determine a source)
-- simply carry no badge.
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN activities.source IS
  'Provenance of the pick: reddit | places | tavily | ai. Surfaced as a badge in the itinerary view.';
