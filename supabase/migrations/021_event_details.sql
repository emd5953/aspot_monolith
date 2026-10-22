-- Evidence and unknown states for discovery; no authenticated write permissions.
ALTER TABLE public.candidate_events
  ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.candidate_events ALTER COLUMN is_free SET DEFAULT NULL;
-- Legacy false meant both "paid" and "unknown". Preserve true, clear ambiguity.
UPDATE public.candidate_events SET is_free = NULL WHERE is_free = FALSE;
CREATE INDEX idx_candidate_events_fetched_at ON public.candidate_events (fetched_at);

-- A thin discovery summary is not evidence that a cancellation or sellout was
-- reversed. Enforce this atomically for every writer, including concurrent cron
-- upserts. An explicit scheduled/available state can clear the old restriction.
CREATE FUNCTION public.preserve_candidate_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.details->>'status', 'unknown') = 'unknown'
     AND OLD.details->>'status' IN ('cancelled', 'postponed') THEN
    NEW.details = jsonb_set(NEW.details, '{status}', OLD.details->'status');
  END IF;
  IF COALESCE(NEW.details->>'availability', 'unknown') = 'unknown'
     AND OLD.details->>'availability' IN ('sold_out', 'registration_closed') THEN
    NEW.details = jsonb_set(NEW.details, '{availability}', OLD.details->'availability');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER candidate_events_preserve_restrictions
BEFORE UPDATE ON public.candidate_events
FOR EACH ROW EXECUTE FUNCTION public.preserve_candidate_restrictions();
