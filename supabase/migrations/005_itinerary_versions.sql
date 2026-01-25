-- Itinerary Version History Table
-- Stores snapshots of itinerary state for version control

CREATE TABLE IF NOT EXISTS itinerary_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(itinerary_id, version_number)
);

-- Index for faster version lookups
CREATE INDEX idx_itinerary_versions_itinerary ON itinerary_versions(itinerary_id);
CREATE INDEX idx_itinerary_versions_created ON itinerary_versions(created_at DESC);

-- RLS Policies
ALTER TABLE itinerary_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view versions of their itineraries" ON itinerary_versions;
DROP POLICY IF EXISTS "Users can create versions for their itineraries" ON itinerary_versions;

-- Users can view versions of itineraries they own or are members of
CREATE POLICY "Users can view versions of their itineraries"
  ON itinerary_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM itineraries i
      WHERE i.id = itinerary_versions.itinerary_id
      AND i.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM itineraries i
      JOIN trips t ON t.itinerary_id = i.id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE i.id = itinerary_versions.itinerary_id
      AND tm.user_id = auth.uid()
    )
  );

-- Users can create versions for their own itineraries
CREATE POLICY "Users can create versions for their itineraries"
  ON itinerary_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries i
      WHERE i.id = itinerary_versions.itinerary_id
      AND i.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM itineraries i
      JOIN trips t ON t.itinerary_id = i.id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE i.id = itinerary_versions.itinerary_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('organizer', 'editor')
    )
  );
