-- "Before you go" content the planner already produces but we used to drop:
-- packing tips and important notes. Stored as JSONB string arrays, nullable so
-- existing rows (and the local fallback path, which doesn't generate them)
-- simply have none.
ALTER TABLE itineraries
ADD COLUMN IF NOT EXISTS packing_tips JSONB,
ADD COLUMN IF NOT EXISTS important_notes JSONB;

COMMENT ON COLUMN itineraries.packing_tips IS 'string[] of packing suggestions from the planner';
COMMENT ON COLUMN itineraries.important_notes IS 'string[] of important notes from the planner';
