# Quiz & Personality Update

## Overview
Updated the quiz system from 10 basic preference questions to 10 personality-focused questions that enable highly curated, personalized itineraries.

## Changes Made

### 1. Quiz Questions (src/data/quiz-questions.ts)
**New 10-question structure:**
1. Travel Motivations (3 picks) - Why they travel
2. Planning Style - Structured vs spontaneous
3. Authenticity Preference - Tourist vs local experiences
4. Activity Types (5 picks) - What they want to do
5. Travel Pace - Very relaxed to intense
6. Time Rhythm - Morning person vs night owl
7. Cuisine Preferences (4 picks) - Food styles
8. Budget Range - Shoestring to luxury
9. Social Style - Solo to family travel
10. Comfort Zone (1-10 scale) - Familiar vs challenging

### 2. Database Schema (supabase/migrations/012_update_user_preferences_schema.sql)
**Removed fields:**
- accommodation_style
- accessibility_needs
- climate_preferences
- cultural_interests
- adventure_tolerance

**Added personality fields:**
- travel_motivations (JSONB array)
- planning_style (TEXT)
- authenticity_preference (TEXT)
- time_rhythm (TEXT)
- comfort_zone (INTEGER 1-10)

**Updated fields:**
- All preference fields now use flexible TEXT/JSONB types
- Migrates existing data with sensible defaults

### 3. Type Definitions (src/types/quiz.ts)
Updated `UserPreferences` interface to match new schema with personality traits.

### 4. Profile Generator (src/lib/quiz/profile-generator.ts)
Maps new quiz answers to new database schema fields.

### 5. AI Agent Prompts
**Updated files:**
- `src/lib/ai/agents/agentic-planner.ts`
- `src/lib/ai/agents/agentic-researcher.ts`
- `src/lib/ai/agents/planner.ts`
- `src/lib/ai/agents/reviewer.ts`
- `src/lib/ai/agents/researcher.ts`

**Curation logic added:**
- **Authenticity Filter**: 
  - `pure_authentic` → ONLY hidden gems, exclude tourist traps
  - `mostly_authentic` → Prioritize local, 1-2 popular spots OK
  - `tourist_friendly` → Popular attractions are fine
  - `balanced` → Mix of both

- **Challenge Level** (based on comfort_zone):
  - High (7-10) → Adventurous, unusual, boundary-pushing
  - Low (1-4) → Well-established, comfortable, familiar
  - Medium (4-7) → Balanced mix

- **Motivation Alignment**:
  - `food` → Extra focus on unique dining
  - `learning` → Educational/historical context
  - `adventure` → Thrilling/active options
  - `relaxation` → Calm, peaceful spots
  - `connection` → Social/interactive experiences

- **Time Rhythm**:
  - `early_bird` → Sunrise activities, early schedule
  - `night_owl` → Late activities, sleep-in mornings
  - `steady_daytime` → Standard 9am-6pm schedule
  - `afternoon_evening` → Peak after lunch

### 6. Activity Density Updates
**Updated counts to match requirements:**
- `very_relaxed`: 2-3 activities
- `relaxed`: 3-4 activities
- `moderate`: 5-6 activities (was 4-5)
- `packed`: 8-10 activities (was 6-8)
- `intense`: 10-12 activities

Files updated:
- `src/lib/ai/itinerary-generator.ts`
- `src/lib/ai/smart-scheduler.ts`

### 7. UI Updates
**Profile Page (src/app/(protected)/profile/page.tsx):**
- Shows personality traits section
- Displays travel motivations
- Removed old fields (accommodation, climate, cultural interests, accessibility)

**Quiz Complete Page:**
- Added safety checks for optional fields

### 8. Safety & Backward Compatibility
**Added null-safe checks throughout:**
- All `.join()` calls use optional chaining: `?.join(', ') || 'default'`
- All preference accesses have fallbacks
- Existing users get sensible defaults until they retake quiz

**Files with safety checks:**
- All AI agent files
- Profile pages
- Preferences service
- Day regeneration service

### 9. Error Handling Improvements
**Agentic Planner (src/lib/ai/agents/agentic-planner.ts):**
- Added try-catch around day building
- Fallback days if AI generation fails
- Better logging for debugging
- Prevents itinerary generation from stopping after day 3

## Migration Path

### For New Users
1. Take the 10-question quiz
2. Get personality-driven itineraries immediately

### For Existing Users
1. Old data is migrated with defaults
2. App continues to work with fallback values
3. Prompt users to retake quiz for better personalization

### Database Migration
Run migration 012:
```sql
-- Apply: supabase/migrations/012_update_user_preferences_schema.sql
```

## Testing Checklist
- [ ] New users can complete quiz
- [ ] Existing users see profile without errors
- [ ] Itineraries generate for all travel paces
- [ ] Activity counts match requirements (3/5/8+ for relaxed/moderate/packed)
- [ ] Multi-day itineraries generate all days (not stopping at day 3)
- [ ] Personality traits affect itinerary curation
- [ ] Authenticity preference filters activities correctly
- [ ] Time rhythm affects activity scheduling

## Expected Outcomes

### Curation Quality
Two users going to the same destination get completely different itineraries:

**User A:** Pure authentic, high comfort zone, food-motivated
→ Hidden local eateries, adventurous experiences, off-beaten-path

**User B:** Tourist friendly, low comfort zone, relaxation-motivated  
→ Popular comfortable spots, calm activities, well-known attractions

### Activity Counts
- Minimal/Relaxed: 3 activities per day
- Moderate: 5 activities per day (minimum)
- Packed: 8+ activities per day

### Personality Impact
- Planning style influences flexibility in schedule
- Time rhythm determines when activities are scheduled
- Social style affects group-friendly vs solo activities
- Motivations prioritize certain experience types
