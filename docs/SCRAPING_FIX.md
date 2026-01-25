# Scraping Fix: Handling 0 Results + Alternative Events

## Problem

When users requested day regeneration with specific activities (nightclubs, sports events, comedy shows), the system was returning 0 scraped results because:

1. **Date-specific queries were too narrow** - Searching for "sports events in San Francisco January 25, 2026" returns nothing because those events aren't scheduled yet
2. **Validation logic was too strict** - The code was filtering out any result that didn't explicitly mention the exact date
3. **No fallback for future dates** - The system didn't handle the case where future-dated events can't be verified
4. **No alternative suggestions** - If the specific event type wasn't available, the system gave up instead of suggesting alternatives

## Solution

### 1. Removed Date-Specific Queries for Future Dates

**Before:**
```typescript
// Added specific date to query
query += ` ${dateStr}`; // "January 25, 2026"
```

**After:**
```typescript
// Use day of week instead (more general)
query += ` ${dayOfWeek}`; // "Sunday"
```

**Why:** Future events aren't scheduled far in advance. Searching for "nightclubs Sunday" is more likely to return results than "nightclubs January 25, 2026".

### 2. Relaxed Validation Logic

**Before:**
```typescript
// Rejected results that didn't mention the exact date
if (!isVenue && !hasDateMention) {
  isValidEvent = false;
}
```

**After:**
```typescript
// Accept all places - don't filter by date
places.push({
  name,
  description: description.substring(0, 200),
  type: categories[0] || 'general',
  details: date ? `Suggested for ${dateStr}` : undefined,
});
```

**Why:** For future dates, we can't verify specific events anyway. Better to suggest venues where events typically happen.

### 3. Improved AI Instructions When No Data

**Before:**
```typescript
${allPlaces.length === 0 ? '⚠️ WARNING: No specific data was scraped.' : ''}
```

**After:**
```typescript
${allPlaces.length > 0 
  ? allPlaces.slice(0, 30).map(item => `- ${item.name}...`).join('\n')
  : `⚠️ No specific data was scraped. Use your knowledge of ${destination} to suggest:
- Popular nightclubs and bars (if user wants nightlife)
- Sports venues and arenas (if user wants sports)
- Comedy clubs and entertainment venues (if user wants shows)
- Well-known restaurants and cafes
- Famous attractions and landmarks

Be specific with venue names and addresses.`
}
```

**Why:** When scraping fails, the AI should still provide useful suggestions based on its training data.

### 4. Updated AI Rules for Events vs Venues

**New Rules:**
```typescript
3. For EVENTS (sports games, concerts, etc.):
   - If the date is in the future, suggest VENUES where these events typically happen
   - Example: "Check Oracle Park for Giants games" or "Visit Chase Center for Warriors games"
   - Include note: "Check schedule closer to date"
4. For VENUES (clubs, bars, restaurants):
   - These can be suggested anytime as they're always open
   - Use real places from the list when available
```

**Why:** Distinguishes between time-sensitive events (need verification) and always-available venues (can suggest anytime).

### 5. Added Alternative Event Fallback

**New Feature:**
```typescript
// STEP 3.5: If no specific events found, search for ANY events on that date
if (eventData.length === 0) {
  console.log('[Day Regeneration] No specific events found, searching for ANY events on this date...');
  const anyEvents = await scrapeAnyEventsOnDate(destination, date);
  console.log(`[Day Regeneration] Found ${anyEvents.length} general events on this date`);
  eventData.push(...anyEvents);
}
```

**New Function:**
```typescript
async function scrapeAnyEventsOnDate(destination: string, date: Date) {
  // Searches for:
  // - "events in [destination] [day of week]"
  // - "things to do [destination] [day of week]"
  // - Eventbrite listings
  // - Timeout.com events
  
  // Returns ANY events happening that day (concerts, shows, festivals, etc.)
}
```

**Updated AI Rules:**
```typescript
3. For EVENTS (sports games, concerts, etc.):
   - If the specific event type requested isn't available, suggest ALTERNATIVE events from the list
   - Example: User wants sports but only concerts available → Suggest the concert as an alternative
   - If no events at all, suggest VENUES where events typically happen
   - Include note: "Alternative to [original request]"
```

**Why:** Better to suggest an alternative event (concert instead of sports) than nothing at all. Users can decide if they want to attend.

## Result

Now when users request activities like "watch a sports game and go clubbing", the system will:

1. Try to scrape for specific sports events on that date
2. **If no sports events found, search for ANY events on that date** (concerts, shows, festivals)
3. **Suggest alternative events with clear labeling**: "Alternative to sports game - Concert at Chase Center"
4. Accept venues even without date verification
5. Fall back to AI knowledge if scraping returns 0 results
6. Suggest venues with notes like "Check schedule closer to date" for events
7. Provide specific nightclub/bar/arena names based on AI's knowledge of the destination

**Priority Order:**
1. Exact event type requested (sports game) ✅
2. Alternative events on that date (concert, comedy show) ✅ NEW!
3. Venues where requested events happen (Oracle Park) ✅
4. AI knowledge of popular venues ✅

## Example Output

**User Request:** "I want to watch a sports game and go clubbing"

**Scenario 1: Sports game available**
```json
{
  "activities": [
    {
      "name": "Warriors vs Lakers at Chase Center",
      "description": "NBA game on Sunday evening",
      "category": "event"
    },
    {
      "name": "Temple Nightclub",
      "description": "Popular nightclub in SoMa district",
      "category": "entertainment"
    }
  ]
}
```

**Scenario 2: No sports, but concert available**
```json
{
  "activities": [
    {
      "name": "Concert at Chase Center",
      "description": "Alternative to sports game - Live music event on Sunday. Check schedule for specific performers.",
      "category": "entertainment"
    },
    {
      "name": "Temple Nightclub",
      "description": "Popular nightclub in SoMa district",
      "category": "entertainment"
    }
  ]
}
```

**Scenario 3: No events at all**
```json
{
  "activities": [
    {
      "name": "Visit Oracle Park",
      "description": "Home of the SF Giants. Check schedule closer to date for game availability.",
      "category": "attraction"
    },
    {
      "name": "Temple Nightclub",
      "description": "Popular nightclub in SoMa district",
      "category": "entertainment"
    }
  ]
}
```

## Testing

To test the fix:

**Test 1: Specific event available**
- Request: "I want to watch a sports game"
- Expected: Returns actual sports events if found

**Test 2: Alternative event fallback**
- Request: "I want to watch a sports game and go clubbing"
- Expected: If no sports, suggests concerts/shows as alternatives with clear labeling

**Test 3: No events, venue fallback**
- Request: "I want to watch a sports game"
- Expected: Suggests sports venues (Oracle Park, Chase Center) with note to check schedule

**Test 4: Always-available venues**
- Request: "I want to go clubbing"
- Expected: Returns specific nightclub names regardless of scraping results

## Future Improvements

1. **Integrate Google Maps Places API** - More reliable than web scraping for venue data
2. **Add event APIs** - Use Ticketmaster, Eventbrite, or SeatGeek APIs for real event data
3. **Cache popular venues** - Store known venues per city to avoid repeated scraping
4. **User feedback loop** - Let users report if suggested venues are closed/incorrect
5. **Smart alternative matching** - Use AI to suggest better alternatives (e.g., if user wants "action", suggest sports OR action movies)
6. **Event calendar integration** - Pull from city event calendars for verified events
