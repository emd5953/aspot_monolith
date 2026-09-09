-- Spotz pivot: single-itinerary NYC product.
-- Drops trips/collab/quiz/preferences machinery, renames activities -> plans,
-- constrains users to one active itinerary.

-- 1) Drop collab + quiz tables (dependency order)
DROP TABLE IF EXISTS public.rsvps CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.trip_members CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.quiz_progress CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;

-- 2) Rename activities -> plans (a "plan" is one stop in the Move-list)
ALTER TABLE public.activities RENAME TO plans;

-- 3) Itineraries: Spotz fields + one-active-per-user
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS vibe_prompt TEXT,
  ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;

-- A Spotz itinerary is one night/day out; start_date == end_date by convention.
-- One active itinerary per user (history rows are 'archived').
CREATE UNIQUE INDEX IF NOT EXISTS one_active_itinerary_per_user
  ON public.itineraries (user_id)
  WHERE status = 'active';
