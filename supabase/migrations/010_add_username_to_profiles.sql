-- Add username column to profiles table
ALTER TABLE public.profiles
ADD COLUMN username TEXT UNIQUE;

-- Add constraint to ensure username is lowercase and alphanumeric with underscores
ALTER TABLE public.profiles
ADD CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]+$');

-- Add comment
COMMENT ON COLUMN public.profiles.username IS 'Unique username for the user, lowercase alphanumeric with underscores only';
