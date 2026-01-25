# Alternative Events Feature

## Overview

When users request a specific type of event (sports game, concert, comedy show) but none are available on that date, the system now intelligently falls back to suggesting **alternative events** happening on the same date.

## How It Works

### 3-Tier Fallback Strategy

```
User Request: "I want to watch a sports game"
         ↓
    ┌────────────────────────────────────┐
    │ Tier 1: Search for sports events  │
    └────────────────────────────────────┘
         ↓
    Found? → YES → Return sports events ✅
         ↓
        NO
         ↓
    ┌────────────────────────────────────┐
    │ Tier 2: Search for ANY events      │
    │ (concerts, shows, festivals, etc.) │
    └────────────────────────────────────┘
         ↓
    Found? → YES → Return as alternatives ✅
         ↓              "Alternative to sports game"
        NO
         ↓
    ┌────────────────────────────────────┐
    │ Tier 3: Suggest venues             │
    │ (stadiums, arenas, etc.)           │
    └────────────────────────────────────┘
         ↓
    Return venue suggestions ✅
    "Visit Oracle Park - Check schedule"
```

## Implementation

### Step 1: Try Specific Event Type
```typescript
const eventData = await scrapeTargetedData(destination, intentAnalysis, date);
// Searches for: "sports events San Francisco Sunday"
```

### Step 2: Fallback to Any Events
```typescript
if (eventData.length === 0) {
  const anyEvents = await scrapeAnyEventsOnDate(destination, date);
  // Searches for:
  // - "events in San Francisco Sunday"
  // - "things to do San Francisco Sunday"
  // - Eventbrite listings
  // - Timeout.com events
  eventData.push(...anyEvents);
}
```

### Step 3: AI Suggests Alternatives
```typescript
// AI receives both specific and alternative events
// AI rules:
// - Prefer exact match (sports game)
// - If not available, suggest alternative with clear label
// - If no events, suggest venues
```

## Example Scenarios

### Scenario 1: Exact Match Available ✅
**User:** "I want to watch a sports game"
**System finds:** Warriors vs Lakers at Chase Center
**Output:**
```json
{
  "name": "Warriors vs Lakers at Chase Center",
  "description": "NBA game on Sunday evening",
  "category": "event"
}
```

### Scenario 2: Alternative Event Available ✅
**User:** "I want to watch a sports game"
**System finds:** No sports, but concert at Chase Center
**Output:**
```json
{
  "name": "Concert at Chase Center",
  "description": "Alternative to sports game - Live music event on Sunday. Check schedule for specific performers.",
  "category": "entertainment"
}
```

### Scenario 3: No Events, Venue Suggestion ✅
**User:** "I want to watch a sports game"
**System finds:** No events at all
**Output:**
```json
{
  "name": "Visit Oracle Park",
  "description": "Home of the SF Giants. Check schedule closer to date for game availability.",
  "category": "attraction"
}
```

## Benefits

1. **Better User Experience** - Always provides suggestions, never returns empty
2. **Flexible Planning** - Users discover events they might not have considered
3. **Realistic Expectations** - Clear labeling when suggesting alternatives
4. **Future-Proof** - Works even when specific events aren't scheduled yet
5. **Graceful Degradation** - Falls back through multiple tiers

## Search Sources

### Tier 1: Specific Events
- Google Search with specific keywords
- Event-specific sites (SeatGeek for sports, etc.)

### Tier 2: Any Events
- Google Search: "events in [city] [day]"
- Google Search: "things to do [city] [day]"
- Eventbrite event listings
- Timeout.com event calendars

### Tier 3: Venues
- AI knowledge of popular venues
- Scraped venue data from TripAdvisor
- Google Maps results

## User Communication

The system clearly communicates when suggesting alternatives:

**Clear Labels:**
- ✅ "Alternative to sports game - Concert at Chase Center"
- ✅ "No sports events found, but here's a great concert"
- ✅ "Check schedule closer to date for game availability"

**Transparent:**
- Users know when they're getting an alternative
- Users can decide if the alternative works for them
- Users understand when to check back for specific events

## Code Location

- Main logic: `src/lib/itinerary/day-regeneration-service.ts`
- Function: `scrapeAnyEventsOnDate()`
- Integration: Lines 430-440 (fallback trigger)

## Future Enhancements

1. **Smart Matching** - Use AI to match alternatives by vibe (action → sports OR action movies)
2. **User Preferences** - Learn which alternatives users accept/reject
3. **Event APIs** - Integrate Ticketmaster, Eventbrite APIs for verified events
4. **Notification System** - Alert users when their preferred event becomes available
5. **Alternative Ranking** - Score alternatives by similarity to original request
