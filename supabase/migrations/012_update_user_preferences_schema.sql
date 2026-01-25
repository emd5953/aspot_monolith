-- Update user_preferences table to support new personality-focused quiz structure
-- This migration transforms the schema to capture richer personality data

-- Drop old columns
ALTER TABLE public.user_preferences
  DROP COLUMN IF EXISTS accommodation_style,
  DROP COLUMN IF EXISTS accessibility_needs,
  DROP COLUMN IF EXISTS climate_preferences,
  DROP COLUMN IF EXISTS cultural_interests,
  DROP COLUMN IF EXISTS adventure_tolerance;

-- Rename existing columns to match new structure
ALTER TABLE public.user_preferences
  RENAME COLUMN cuisine_preferences TO cuisine_preferences_old;

ALTER TABLE public.user_preferences
  RENAME COLUMN activity_types TO activity_types_old;

ALTER TABLE public.user_preferences
  RENAME COLUMN budget_range TO budget_range_old;

ALTER TABLE public.user_preferences
  RENAME COLUMN travel_pace TO travel_pace_old;

ALTER TABLE public.user_preferences
  RENAME COLUMN social_preferences TO social_preferences_old;

-- Add new personality-focused columns
ALTER TABLE public.user_preferences
  ADD COLUMN travel_motivations JSONB DEFAULT '[]',
  ADD COLUMN planning_style TEXT,
  ADD COLUMN authenticity_preference TEXT,
  ADD COLUMN time_rhythm TEXT,
  ADD COLUMN comfort_zone INTEGER CHECK (comfort_zone BETWEEN 1 AND 10);

-- Add new preference columns with updated structure
ALTER TABLE public.user_preferences
  ADD COLUMN activity_types JSONB DEFAULT '[]',
  ADD COLUMN cuisine_preferences JSONB DEFAULT '[]',
  ADD COLUMN budget_range TEXT,
  ADD COLUMN travel_pace TEXT,
  ADD COLUMN social_preferences TEXT;

-- Migrate existing data to new columns (best effort)
UPDATE public.user_preferences
SET
  activity_types = activity_types_old,
  cuisine_preferences = cuisine_preferences_old,
  budget_range = budget_range_old,
  travel_pace = travel_pace_old,
  social_preferences = social_preferences_old,
  -- Set reasonable defaults for new fields
  planning_style = 'structured_flexible',
  authenticity_preference = 'balanced',
  time_rhythm = 'steady_daytime',
  comfort_zone = 5;

-- Drop old columns after migration
ALTER TABLE public.user_preferences
  DROP COLUMN cuisine_preferences_old,
  DROP COLUMN activity_types_old,
  DROP COLUMN budget_range_old,
  DROP COLUMN travel_pace_old,
  DROP COLUMN social_preferences_old;

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.travel_motivations IS 'Array of travel motivations (escape, discovery, adventure, etc.)';
COMMENT ON COLUMN public.user_preferences.planning_style IS 'Planning approach: hyper_planner, structured_flexible, loose_framework, pure_spontaneous';
COMMENT ON COLUMN public.user_preferences.authenticity_preference IS 'Preference for authentic vs tourist experiences';
COMMENT ON COLUMN public.user_preferences.time_rhythm IS 'Daily energy rhythm: early_bird, steady_daytime, afternoon_evening, night_owl';
COMMENT ON COLUMN public.user_preferences.comfort_zone IS 'Comfort zone rating 1-10 (1=familiar, 10=challenging)';
