# Date-Aware Event Validation

## The Problem

**Before:**
```
User: "I want to watch a sports game"
Date: January 25, 2026 (random Saturday)
System: "Watch the San Francisco 49ers Game at Levi's Stadium"
Reality: ❌ No game scheduled that day (season might be over)
```

**After:**
```
User: "I want to watch a sports game"
Date: January 25, 2026
System: 
  1. Searches "sports events San Francisco January 25, 2026"
  2. Finds actual events on that date
  3. If no game: Suggests "Visit Levi's Stadium Tour" instead
Result: ✅ Only real events or venue alternatives
```

## How It Works

### 1. Date-Aware Search Queries

When scraping for events, the system includes the **specific date**:

```typescript
// Before
"sports events San Francisco"

// After  
"sports events San Francisco January 25, 2026"
```

This ensures Google returns only events happening on that date.

### 2. Event vs Venue Detection

The system distinguishes between:

**Events** (time-specific):
- Sports games
- Concerts
- Shows
- Festivals

**Venues** (always available):
- Stadiums
- Arenas
- Clubs
- Restaurants

```typescript
const isVenue = name.includes('stadium') || 
                name.includes('arena') ||
                name.includes('center');

if (!isVenue && !hasDateMention) {
  // This is a generic event, not happening on this date
  isValidEvent = false;
}
```

### 3. Date Validation in Scraped Content

When extracting events, the system checks if the description mentions the date:

```typescript
const hasDateMention = 
  description.includes("January 25") ||
  description.includes("Saturday");

if (isEvent && !hasDateMention) {
  // Skip this - not happening on the requested date
}
```

### 4. Event-Specific Sources

For sports/events, the system scrapes specialized sites:

- **Eventbrite** - Local events by date
- **SeatGeek** - Sports tickets and schedules
- **Google Events** - Aggregated event listings

```typescript
if (intent.categories.includes('sports')) {
  const eventPlaces = await scrapeEventSources(destination, date, keywords);
  // Returns only events verified for that date
}
```

### 5. Fallback to Venue Suggestions

If no event is found for the date, the AI suggests the venue instead:

```
❌ "Watch the 49ers Game" (no game that day)
✅ "Visit Levi's Stadium Tour" (venue is always there)
✅ "Explore Oracle Park" (venue alternative)
```

## Example Scenarios

### Scenario 1: Real Event Found
```
Date: October 15, 2026
Request: "sports game"

Scraping:
- Query: "sports events San Francisco October 15, 2026"
- Finds: "Warriors vs Lakers at Chase Center - Oct 15, 2026"

Result:
✅ "Watch Warriors vs Lakers at Chase Center"
   Description: "NBA game on October 15, 2026"
```

### Scenario 2: No Event, Venue Suggested
```
Date: July 4, 2026
Request: "sports game"

Scraping:
- Query: "sports events San Francisco July 4, 2026"
- Finds: No games (off-season)
- Finds: "Chase Center" (venue)

Result:
✅ "Visit Chase Center"
   Description: "Explore the home of the Warriors (no game scheduled this date)"
```

### Scenario 3: Multiple Events
```
Date: December 31, 2026
Request: "nightlife and events"

Scraping:
- Query: "events San Francisco December 31, 2026"
- Finds: "New Year's Eve at The Fillmore"
- Finds: "NYE Party at 1015 Folsom"

Result:
✅ "New Year's Eve Concert at The Fillmore"
✅ "NYE Party at 1015 Folsom"
   Both verified for December 31, 2026
```

## Technical Implementation

### Search Query Enhancement
```typescript
const dateStr = date.toLocaleDateString('en-US', { 
  month: 'long', 
  day: 'numeric', 
  year: 'numeric' 
});

// For events, add date to query
if (isEventQuery) {
  query += ` ${dateStr}`;
}
```

### Content Validation
```typescript
function extractPlacesFromContent(content, categories, date) {
  for (const line of lines) {
    // Check if line mentions the specific date
    const hasDateMention = 
      line.includes(dateStr) || 
      line.includes(dayOfWeek);
    
    // For events, require date mention
    if (isEvent && !hasDateMention) {
      continue; // Skip this result
    }
    
    places.push({ name, description, verified: true });
  }
}
```

### AI Prompt Instructions
```
CRITICAL RULES:
3. For EVENTS (sports games, concerts, etc.):
   - ONLY suggest if the event is listed above with date verification
   - If no event is listed for that date, suggest the VENUE instead
   - NEVER invent events that aren't verified
```

## Validation Levels

### Level 1: Date in Search Query
- Searches include specific date
- Google filters results to that date

### Level 2: Content Parsing
- Checks if scraped content mentions the date
- Filters out generic event listings

### Level 3: Event Source Verification
- Scrapes Eventbrite, SeatGeek for confirmed events
- Extracts only events with date confirmation

### Level 4: AI Instruction
- AI is explicitly told to distinguish events vs venues
- Must not invent events without verification

## Example Output

### With Real Event:
```json
{
  "name": "Warriors vs Lakers at Chase Center",
  "description": "NBA game on January 25, 2026 - verified event",
  "locationName": "Chase Center",
  "category": "entertainment",
  "duration": 180,
  "estimatedCost": 150
}
```

### Without Event (Venue Fallback):
```json
{
  "name": "Visit Chase Center",
  "description": "Tour the home of the Warriors (no game scheduled for this date, but venue tours available)",
  "locationName": "Chase Center",
  "category": "attraction",
  "duration": 90,
  "estimatedCost": 25
}
```

## Limitations & Future Improvements

### Current Limitations:
1. Relies on web scraping accuracy
2. May miss events not indexed by Google
3. No direct API integration with ticketing platforms

### Future Improvements:
1. **Direct API Integration:**
   - SeatGeek API for sports schedules
   - Ticketmaster API for concerts
   - Eventbrite API for local events

2. **Team Schedule APIs:**
   - NFL, NBA, MLB official APIs
   - Get exact game schedules

3. **Real-time Availability:**
   - Check if tickets are still available
   - Show sold-out status

4. **Price Validation:**
   - Scrape actual ticket prices
   - Update estimated costs with real data

5. **Venue Hours:**
   - Check if venue is open on that day
   - Validate operating hours

## Configuration

No additional configuration needed beyond:
```env
TAVILY_API_KEY=your-key
OPENAI_API_KEY=your-key
```

## Testing

To test date-aware validation:

1. Pick a date in the future
2. Request "sports game" or "concert"
3. Check if suggested event is real for that date
4. If no event, should suggest venue visit instead

Example test cases:
- ✅ "sports game" on game day → Real game
- ✅ "sports game" on off-season → Venue tour
- ✅ "concert" on concert date → Real concert
- ✅ "concert" on random date → Music venue visit
