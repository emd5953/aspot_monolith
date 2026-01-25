-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quiz progress policies
CREATE POLICY "Users can view their own quiz progress" ON public.quiz_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz progress" ON public.quiz_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz progress" ON public.quiz_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quiz progress" ON public.quiz_progress
  FOR DELETE USING (auth.uid() = user_id);


-- Itineraries policies
CREATE POLICY "Users can view their own itineraries" ON public.itineraries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view itineraries they are trip members of" ON public.itineraries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.trip_members tm ON t.id = tm.trip_id
      WHERE t.itinerary_id = itineraries.id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own itineraries" ON public.itineraries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries" ON public.itineraries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Trip members can update itineraries" ON public.itineraries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.trip_members tm ON t.id = tm.trip_id
      WHERE t.itinerary_id = itineraries.id AND tm.user_id = auth.uid()
    )
  );

-- Itinerary days policies
CREATE POLICY "Users can view days of their itineraries" ON public.itinerary_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_days.itinerary_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can view itinerary days" ON public.itinerary_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      JOIN public.trips t ON t.itinerary_id = i.id
      JOIN public.trip_members tm ON tm.trip_id = t.id
      WHERE i.id = itinerary_days.itinerary_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert days to their itineraries" ON public.itinerary_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update days of their itineraries" ON public.itinerary_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_days.itinerary_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete days of their itineraries" ON public.itinerary_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_days.itinerary_id AND i.user_id = auth.uid()
    )
  );


-- Activities policies
CREATE POLICY "Users can view activities of their itineraries" ON public.activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = activities.day_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can view activities" ON public.activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      JOIN public.trips t ON t.itinerary_id = i.id
      JOIN public.trip_members tm ON tm.trip_id = t.id
      WHERE d.id = activities.day_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities to their itineraries" ON public.activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = day_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert activities" ON public.activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      JOIN public.trips t ON t.itinerary_id = i.id
      JOIN public.trip_members tm ON tm.trip_id = t.id
      WHERE d.id = day_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update activities of their itineraries" ON public.activities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = activities.day_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete activities of their itineraries" ON public.activities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = activities.day_id AND i.user_id = auth.uid()
    )
  );

-- Itinerary versions policies
CREATE POLICY "Users can view versions of their itineraries" ON public.itinerary_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_versions.itinerary_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert versions to their itineraries" ON public.itinerary_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_id AND i.user_id = auth.uid()
    )
  );


-- Trips policies
CREATE POLICY "Users can view trips they organize" ON public.trips
  FOR SELECT USING (auth.uid() = organizer_id);

CREATE POLICY "Trip members can view their trips" ON public.trips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trips.id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips" ON public.trips
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their trips" ON public.trips
  FOR UPDATE USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their trips" ON public.trips
  FOR DELETE USING (auth.uid() = organizer_id);

-- Trip members policies
CREATE POLICY "Trip members can view other members" ON public.trip_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trip_members.trip_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join trips" ON public.trip_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can remove members" ON public.trip_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_members.trip_id AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave trips" ON public.trip_members
  FOR DELETE USING (auth.uid() = user_id);

-- Suggestions policies
CREATE POLICY "Trip members can view suggestions" ON public.suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = suggestions.trip_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create suggestions" ON public.suggestions
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by AND
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trip_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can update suggestions" ON public.suggestions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = suggestions.trip_id AND t.organizer_id = auth.uid()
    )
  );


-- Votes policies
CREATE POLICY "Trip members can view votes" ON public.votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.suggestions s
      JOIN public.trip_members tm ON tm.trip_id = s.trip_id
      WHERE s.id = votes.suggestion_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can cast votes" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.suggestions s
      JOIN public.trip_members tm ON tm.trip_id = s.trip_id
      WHERE s.id = suggestion_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own votes" ON public.votes
  FOR UPDATE USING (auth.uid() = user_id);

-- RSVPs policies
CREATE POLICY "Trip members can view RSVPs" ON public.rsvps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.itinerary_days d ON d.id = a.day_id
      JOIN public.itineraries i ON i.id = d.itinerary_id
      JOIN public.trips t ON t.itinerary_id = i.id
      JOIN public.trip_members tm ON tm.trip_id = t.id
      WHERE a.id = rsvps.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can submit RSVPs" ON public.rsvps
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.itinerary_days d ON d.id = a.day_id
      JOIN public.itineraries i ON i.id = d.itinerary_id
      JOIN public.trips t ON t.itinerary_id = i.id
      JOIN public.trip_members tm ON tm.trip_id = t.id
      WHERE a.id = activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own RSVPs" ON public.rsvps
  FOR UPDATE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Notification preferences policies
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
