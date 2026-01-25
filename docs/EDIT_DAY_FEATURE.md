# Edit Day Feature

## Overview
The "Edit Day" feature allows users to regenerate a single day of their itinerary using natural language. Instead of regenerating the entire trip, users can describe what they want for a specific day and the AI will update just that day.

## How It Works

### User Flow
1. Open an itinerary
2. Navigate to the day you want to edit
3. Click the "✏️ Edit Day" button at the top of the day
4. A modal opens showing:
   - Current activities for that day
   - A text box to describe what you want
   - Example prompts to help you get started
5. Type your request (e.g., "I want more food experiences and less museums")
6. Click "🪄 Regenerate Day"
7. AI generates new activities based on your request (5-15 seconds)
8. The day is updated with new activities

### Example Prompts
- "I want more food experiences and less museums"
- "Make it more relaxing with spa time"
- "Add adventure activities like hiking"
- "Focus on local culture and hidden gems"
- "I'm feeling tired, make it a lighter day"

## Technical Implementation

### Components

#### EditDayModal (`src/components/itinerary/edit-day-modal.tsx`)
- Modal dialog for editing a day
- Shows current activities as context
- Provides example prompts
- Handles submission and loading states
- Auto-focuses on text input

#### DaySchedule (`src/components/itinerary/day-schedule.tsx`)
- Added "Edit Day" button next to "Add Activity"
- Passes day information to parent component
- Triggers modal opening

#### ItineraryView (`src/components/itinerary/itinerary-view.tsx`)
- Passes `onEditDay` handler to DaySchedule
- Provides day ID, number, and activities to handler

### API Endpoint

**POST** `/api/itinerary/[id]/days/[dayId]/regenerate`

Request body:
```json
{
  "prompt": "I want more outdoor activities"
}
```

Response:
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "title": "Morning Hike",
      "description": "...",
      "locationName": "Griffith Park",
      "category": "activity",
      "estimatedCost": 0,
      "sortOrder": 1,
      "notes": "Regenerated based on: \"I want more outdoor activities\""
    }
  ]
}
```

### Service Layer

#### Day Regeneration Service (`src/lib/itinerary/day-regeneration-service.ts`)
- Takes user prompt and preferences
- Calls OpenAI GPT-4o-mini with context:
  - Destination
  - Day number and date
  - User preferences (activities, cuisine, budget, pace)
  - Current activities (for context)
  - User's natural language request
- Parses AI response (JSON format)
- Deletes old activities
- Inserts new activities
- Updates itinerary timestamp
- Returns new activities

### AI Prompt Structure
```
You are a travel planning AI. Generate activities for a single day.

Destination: Paris
Day: 2
Date: Monday, January 27, 2026

User Preferences:
- Activities: museums, food tours, shopping
- Cuisine: French, Italian
- Budget: moderate
- Pace: relaxed

Current Activities:
- Louvre Museum: World-famous art museum
- Eiffel Tower: Iconic landmark

User's Request: "I want more food experiences and less museums"

Generate 3-6 activities with specific locations...
```

## Features

### Context-Aware
- AI sees current activities to understand what to change
- Uses user preferences from quiz
- Considers destination and day number
- Respects budget and pace preferences

### Fast Generation
- Single day regeneration: 5-15 seconds
- Much faster than full itinerary regeneration (45-60s)
- Uses GPT-4o-mini for speed and cost efficiency

### User-Friendly
- Natural language input (no complex forms)
- Example prompts to inspire users
- Shows current activities for reference
- Loading state with time estimate
- Error handling with user feedback

### Preserves Context
- Adds note to activities: "Regenerated based on: [prompt]"
- Updates itinerary timestamp
- Maintains day structure and date
- Keeps other days unchanged

## Database Changes

### Activities Table
- Old activities are deleted
- New activities are inserted with:
  - `day_id`: Links to the specific day
  - `sort_order`: Sequential ordering (1, 2, 3...)
  - `notes`: Includes the user's prompt for reference

### Itineraries Table
- `updated_at` timestamp is updated
- Triggers version tracking (if enabled)

## Benefits

1. **Granular Control**: Edit one day without affecting others
2. **Fast Iteration**: Quick regeneration for experimentation
3. **Natural Language**: No need to learn complex UI
4. **Context Preservation**: AI understands what you want to change
5. **Cost Efficient**: Single day = less tokens = lower cost
6. **User Empowerment**: Feel in control of your itinerary

## Future Enhancements

Possible improvements:
- Edit multiple days at once
- Undo/redo functionality
- Save multiple versions of a day
- AI suggestions based on weather
- Time-of-day preferences (morning person vs night owl)
- Activity duration adjustments
- Budget constraints per day
