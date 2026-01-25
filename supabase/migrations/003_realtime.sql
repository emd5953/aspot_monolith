-- Enable Realtime for collaborative features
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
