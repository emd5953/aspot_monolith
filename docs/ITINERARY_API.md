# Itinerary CRUD API Reference

Complete API endpoints for managing itineraries, days, and activities.

## Itinerary Operations

### Create Itinerary
```
POST /api/itinerary/generate
Body: {
  destination: string
  startDate: string (ISO date)
  endDate: string (ISO date)
  title?: string
  useAgenticMode?: boolean
}
Response: { itinerary: GeneratedItinerary }
```

### List Itineraries
```
GET /api/itinerary/list
Response: { itineraries: GeneratedItinerary[] }
```

### Get Itinerary
```
GET /api/itinerary/[id]
Response: { itinerary: GeneratedItinerary }
```

### Update Itinerary
```
PATCH /api/itinerary/[id]
Body: {
  title?: string
  destination?: string
  startDate?: string (ISO date)
  endDate?: string (ISO date)
  status?: 'draft' | 'active' | 'completed' | 'archived'
}
Response: { itinerary: GeneratedItinerary }
```

### Delete Itinerary
```
DELETE /api/itinerary/[id]
Response: { success: true }
```

### Regenerate Itinerary
```
POST /api/itinerary/[id]/regenerate
Body: {
  excludeActivities?: string[]
  focusAreas?: string[]
}
Response: { itinerary: GeneratedItinerary }
```

## Activity Operations

### Add Activity
```
POST /api/itinerary/[id]/activities
Body: {
  dayId: string (required)
  title: string (required)
  description?: string
  locationName?: string
  locationCoords?: { lat: number, lng: number }
  startTime?: string (HH:MM)
  endTime?: string (HH:MM)
  category?: string
  estimatedCost?: number
  notes?: string
}
Response: { activity: Activity }
```

### Update Activity
```
PATCH /api/itinerary/[id]/activities/[activityId]
Body: {
  title?: string
  description?: string
  locationName?: string
  locationCoords?: { lat: number, lng: number }
  startTime?: string (HH:MM)
  endTime?: string (HH:MM)
  category?: string
  estimatedCost?: number
  notes?: string
}
Response: { activity: Activity }
```

### Delete Activity
```
DELETE /api/itinerary/[id]/activities/[activityId]
Response: { success: true }
```

### Reorder Activities
```
POST /api/itinerary/[id]/activities/reorder
Body: {
  dayId: string
  activityIds: string[] (ordered array of activity IDs)
}
Response: {
  success: true
  conflicts?: TimeConflict[]
}
```

### Move Activity to Different Day
```
POST /api/itinerary/[id]/activities/move
Body: {
  activityId: string
  targetDayId: string
}
Response: { activity: Activity }
```

## Day Operations

### Get Day Activities
```
GET /api/itinerary/[id]/days/[dayId]
Response: { activities: Activity[] }
```

### Update Day Notes
```
PATCH /api/itinerary/[id]/days/[dayId]
Body: {
  notes: string
}
Response: { success: true }
```

## Version History

### List Versions
```
GET /api/itinerary/[id]/versions
Response: { versions: ItineraryVersion[] }
```

### Revert to Version
```
POST /api/itinerary/[id]/revert
Body: {
  versionId: string
}
Response: { success: true }
```

## Types

### GeneratedItinerary
```typescript
{
  id: string
  userId: string
  title: string
  destination: string
  startDate: Date
  endDate: Date
  days: DayPlan[]
  status: 'draft' | 'active' | 'completed' | 'archived'
  createdAt: Date
}
```

### Activity
```typescript
{
  id: string
  dayId: string
  title: string
  description: string
  locationName?: string
  locationCoords?: { lat: number; lng: number }
  startTime?: string
  endTime?: string
  category: string
  estimatedCost?: number
  sortOrder: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

### TimeConflict
```typescript
{
  activity1Id: string
  activity1Title: string
  activity2Id: string
  activity2Title: string
  overlapMinutes: number
}
```

## Authentication

All endpoints require authentication. Include the Supabase session cookie in requests.

## Error Responses

```typescript
{ error: string } // with appropriate HTTP status code
```

Common status codes:
- 400: Bad Request (missing/invalid parameters)
- 401: Unauthorized (not logged in)
- 403: Forbidden (not the owner)
- 404: Not Found
- 500: Internal Server Error
