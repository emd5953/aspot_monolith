-- Add timing fields to activities table
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS duration INTEGER; -- Duration in minutes

-- Add comment for clarity
COMMENT ON COLUMN activities.start_time IS 'Scheduled start time for the activity';
COMMENT ON COLUMN activities.end_time IS 'Scheduled end time for the activity';
COMMENT ON COLUMN activities.duration IS 'Activity duration in minutes';
