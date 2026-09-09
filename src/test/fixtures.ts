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

export const mockItinerary = {
  id: 'test-itinerary-id',
  user_id: 'test-user-id',
  title: 'Moves for tonight',
  destination: 'New York City',
  start_date: '2026-09-05',
  end_date: '2026-09-05',
  status: 'draft' as const,
  preferences_snapshot: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockActivity = {
  id: 'test-activity-id',
  day_id: 'test-day-id',
  title: 'Warehouse party at Space Bushwick',
  description: 'Late-night techno function',
  location_name: 'Space Bushwick',
  location_address: '839 Broadway, Brooklyn, NY',
  location_lat: 40.6957,
  location_lng: -73.93,
  start_time: '22:00',
  end_time: '02:00',
  category: 'event',
  estimated_cost: 25.0,
  currency: 'USD',
  booking_url: null,
  notes: null,
  sort_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
