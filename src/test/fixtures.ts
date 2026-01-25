// Test fixtures for common data structures

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
};

export const mockProfile = {
  id: 'test-user-id',
  display_name: 'Test User',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockUserPreferences = {
  id: 'test-preferences-id',
  user_id: 'test-user-id',
  cuisine_preferences: ['italian', 'japanese'],
  activity_types: ['hiking', 'museums'],
  budget_range: 'moderate' as const,
  travel_pace: 'relaxed' as const,
  accommodation_style: 'hotel' as const,
  social_preferences: 'small_group' as const,
  accessibility_needs: [],
  climate_preferences: ['warm'],
  cultural_interests: ['history', 'art'],
  adventure_tolerance: 5,
  raw_answers: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockQuizProgress = {
  id: 'test-progress-id',
  user_id: 'test-user-id',
  current_step: 3,
  answers: {
    q1: { questionId: 'q1', value: 'italian' },
    q2: { questionId: 'q2', value: ['hiking', 'museums'] },
  },
  started_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockItinerary = {
  id: 'test-itinerary-id',
  user_id: 'test-user-id',
  title: 'Trip to Paris',
  destination: 'Paris, France',
  start_date: '2025-03-01',
  end_date: '2025-03-05',
  status: 'draft' as const,
  preferences_snapshot: mockUserPreferences,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockActivity = {
  id: 'test-activity-id',
  day_id: 'test-day-id',
  title: 'Visit Eiffel Tower',
  description: 'Iconic landmark',
  location_name: 'Eiffel Tower',
  location_address: 'Champ de Mars, Paris',
  location_lat: 48.8584,
  location_lng: 2.2945,
  start_time: '10:00',
  end_time: '12:00',
  category: 'sightseeing',
  estimated_cost: 25.0,
  currency: 'EUR',
  booking_url: null,
  notes: null,
  sort_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockTrip = {
  id: 'test-trip-id',
  itinerary_id: 'test-itinerary-id',
  organizer_id: 'test-user-id',
  invite_code: 'ABC123',
  max_members: 10,
  status: 'planning' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
