# Smart Scheduling & Activity Density Feature

## Overview
This feature adds intelligent time management and activity density control to itinerary generation, ensuring realistic schedules with proper meal timing, travel gaps, and activity durations.

## Key Features

### 1. Activity Density Filter
Users can now choose how packed their days should be:

- **Relaxed** 🌴: 2-3 activities per day (excluding meals)
  - Perfect for slow travelers who want to savor each experience
  - More downtime between activities
  - Ideal for families or those who prefer a leisurely pace

- **Moderate** ⚖️: 4-5 activities per day (excluding meals)
  - Balanced approach for most travelers
  - Good mix of activities and rest time
  - Default option

- **Packed** ⚡: 6-8 activities per day (excluding meals)
  - For energetic travelers who want to see everything
  - Maximizes experiences in limited time
  - Requires good stamina

### 2. Smart Time Scheduling
Every activity now has:
- **Start Time**: When the activity begins
- **End Time**: When the activity ends
- **Duration**: How long the activity takes (in minutes)

#### Time Allocation Rules:
- Day starts at 09:00 by default
- Day ends at 22:00 by default
- Activities are scheduled sequentially with gaps
- 20-minute travel time between activities
- Realistic durations based on activity type

#### Duration by Category:
```typescript
- Attractions: 90 minutes
- Museums: 120 minutes
- Dining: 75 minutes
- Breakfast: 45 minutes
- Lunch: 60 minutes
- Dinner: 90 minutes
- Activities: 120 minutes
- Shopping: 90 minutes
- Entertainment: 150 minutes
- Nature/Beach: 180 minutes
- Sports: 120 minutes
```

### 3. Smart Meal Suggestions
The system automatically inserts meals at appropriate times:

#### Meal Windows:
- **Breakfast**: 08:00 - 10:00
- **Lunch**: 12:00 - 14:00
- **Dinner**: 18:30 - 20:30

#### Intelligent Meal Selection:
Meals are suggested based on user's cuisine preferences:
- Italian preferences → "Italian Café & Cornetto", "Trattoria Lunch", "Authentic Italian Ristorante"
- Asian preferences → "Dim Sum Breakfast", "Ramen Shop", "Upscale Asian Fusion"
- Default → "Local Café Breakfast", "Local Restaurant Lunch", "Fine Dining Experience"

### 4. Time Gaps Between Activities
- Minimum 20-minute gap between activities for travel
- Prevents unrealistic back-to-back scheduling
- Accounts for walking, transportation, or rest time

### 5. Clickable Google Maps Navigation
Map markers now include:
- Activity number and title
- Location address
- **"Navigate Here" button** that opens Google Maps directions
- Direct link to turn-by-turn navigation

## Technical Implementation

### New Components

#### 1. Smart Scheduler Service (`src/lib/ai/smart-scheduler.ts`)
```typescript
export function scheduleActivities(
  activities: Activity[],
  options: SchedulingOptions
): ScheduledActivity[]
```

Features:
- Filters activities based on density preference
- Inserts meals at appropriate times
- Assigns start/end times with travel gaps
- Validates schedule doesn't exceed day limits

#### 2. Database Schema Updates
New migration: `011_add_activity_timing.sql`
```sql
ALTER TABLE activities
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME,
ADD COLUMN duration INTEGER;
```

### Updated Components

#### 1. Generate Form (`src/components/itinerary/generate-form.tsx`)
- Added activity density selector with 3 options
- Visual buttons with emojis and descriptions
- Passes density preference to API

#### 2. Activity Card (`src/components/itinerary/activity-card.tsx`)
- Displays start/end times
- Shows duration (e.g., "2h 30m")
- Enhanced category emojis for meal types
- Color-coded categories including breakfast/lunch/dinner

#### 3. Itinerary Map (`src/components/itinerary/itinerary-map.tsx`)
- Clickable markers with info windows
- "Navigate Here" button in each marker
- Opens Google Maps with directions
- Proper URL encoding for coordinates

#### 4. Itinerary Generator (`src/lib/ai/itinerary-generator.ts`)
- Accepts `activityDensity` parameter
- Applies smart scheduling to all generated activities
- Saves timing data to database
- Works with fast mode and agentic mode

## User Experience Flow

1. **User selects activity density** on generation form
2. **AI generates activities** based on density (excluding meals)
3. **Smart scheduler processes activities**:
   - Filters to match density target
   - Inserts breakfast, lunch, dinner
   - Assigns realistic start/end times
   - Adds 20-min gaps between activities
4. **User views itinerary** with complete schedule
5. **User clicks map marker** to navigate to location

## Example Schedule (Moderate Density)

```
Day 1 - Paris
├─ 08:30 - 09:15 (45m) 🥐 French Café & Croissants
├─ [20 min travel]
├─ 09:35 - 11:05 (90m) 🏛️ Eiffel Tower
├─ [20 min travel]
├─ 11:25 - 12:55 (90m) 🛍️ Champs-Élysées Shopping
├─ [20 min travel]
├─ 13:15 - 14:15 (60m) 🍱 Trattoria Lunch
├─ [20 min travel]
├─ 14:35 - 16:35 (120m) 🖼️ Louvre Museum
├─ [20 min travel]
├─ 16:55 - 18:55 (120m) 🌲 Luxembourg Gardens
├─ [20 min travel]
├─ 19:15 - 20:45 (90m) 🍷 Fine Dining Experience
```

## Benefits

### For Users:
- ✅ Realistic, achievable schedules
- ✅ No more wondering "when should I eat?"
- ✅ Proper time for travel between locations
- ✅ Easy navigation with one-click directions
- ✅ Control over how busy their days are

### For the System:
- ✅ Structured time data for better planning
- ✅ Consistent meal placement
- ✅ Validated schedules (no overlaps)
- ✅ Better integration with maps
- ✅ More professional itineraries

## Future Enhancements

Potential improvements:
- [ ] Custom day start/end times
- [ ] Dietary restrictions for meal suggestions
- [ ] Public transport time estimates
- [ ] Weather-aware scheduling
- [ ] Energy level tracking (morning person vs night owl)
- [ ] Budget-aware meal suggestions
- [ ] Restaurant reservations integration
- [ ] Real-time traffic updates

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - For maps and navigation

### Default Settings
Can be customized in `smart-scheduler.ts`:
```typescript
const TRAVEL_TIME_MINUTES = 20; // Gap between activities
const MEAL_WINDOWS = {
  breakfast: { start: '08:00', end: '10:00' },
  lunch: { start: '12:00', end: '14:00' },
  dinner: { start: '18:30', end: '20:30' },
};
```

## Testing

To test the feature:
1. Generate a new itinerary
2. Select different activity densities
3. Verify activities have start/end times
4. Check meals are inserted at appropriate times
5. Confirm 20-minute gaps between activities
6. Click map markers to test navigation links

## Migration

Existing itineraries without timing data will:
- Display normally (times are optional)
- Can be regenerated to add timing
- No data loss or breaking changes
