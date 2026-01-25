# Scraping Sources Overview

## What We Scrape and Why

### Full Itinerary Generation (Agentic Researcher)

When generating a complete itinerary, we scrape **4 main sources**:

#### 1. TripAdvisor
- **What:** Attractions, activities, reviews
- **Why:** Most comprehensive attraction database, trusted reviews
- **Query:** Personalized to user's activity preferences
- **Example:** `San Francisco hiking` (if user likes hiking)

#### 2. Google Maps
- **What:** Local businesses, restaurants, reviews
- **Why:** Real-time data, accurate locations, local favorites
- **Query:** Personalized to user's interests
- **Example:** `San Francisco adventure activities`

#### 3. Google Search (Restaurants)
- **What:** Restaurant reviews, cuisine-specific searches
- **Why:** Finds best restaurants matching user's cuisine preferences
- **Query:** Personalized to cuisine preferences
- **Example:** `San Francisco italian restaurants reviews`

#### 4. Reddit (via Google)
- **What:** Local insider tips, hidden gems, warnings
- **Why:** Real locals sharing honest opinions, things tourists miss
- **Query:** Personalized to budget and travel style
- **Example:** `site:reddit.com San Francisco budget travel tips`

### Day Regeneration (Targeted Scraping)

When regenerating a single day based on user request, we scrape **multiple sources**:

#### Primary Sources (Always)

**1. Google Search (Targeted)**
- User's specific request
- Example: `best nightclubs in San Francisco Sunday`

**2. Reddit (Local Insights)** ✅ NEW!
- **What:** Local recommendations, insider tips
- **Why:** Locals know the best spots tourists don't
- **Queries:**
  - `site:reddit.com San Francisco [user request]`
  - `site:reddit.com San Francisco hidden gems`
  - `site:reddit.com San Francisco locals recommend`
  - `site:reddit.com San Francisco [day of week] night`
- **Example Output:** "Local recommendation from Reddit: Check out Temple Nightclub - it's amazing on Saturdays"

**3. Google Reviews (Nightlife)** ✅ NEW!
- **What:** Reviews for nightlife, entertainment venues
- **Why:** Real user experiences, current status (open/closed)
- **Query:** `San Francisco nightlife Sunday reviews`

#### Event-Specific Sources (When Needed)

**4. Eventbrite**
- **What:** Concerts, festivals, community events
- **Why:** Comprehensive event calendar
- **URL:** `eventbrite.com/d/san-francisco/events`

**5. Timeout.com**
- **What:** Curated events, shows, activities
- **Why:** Editorial picks, quality events
- **URL:** `timeout.com/san-francisco/things-to-do`

**6. SeatGeek**
- **What:** Sports events, concerts, theater
- **Why:** Ticket availability = confirmed events
- **URL:** `seatgeek.com/san-francisco-tickets`

#### Fallback Sources

**7. TripAdvisor (Fallback)**
- Used when primary sources return < 3 results
- General destination search

**8. Any Events Search (Fallback)**
- Searches for ANY events on that date
- Used when specific event type not found

## Scraping Strategy by Request Type

### Sports Events
```
1. Google: "sports events San Francisco Sunday"
2. SeatGeek: Sports tickets
3. Reddit: "site:reddit.com San Francisco sports bars"
4. Fallback: Any events on that date
```

### Nightlife
```
1. Google: "best nightclubs San Francisco Sunday"
2. Google Reviews: "San Francisco nightlife Sunday reviews"
3. Reddit: "site:reddit.com San Francisco Sunday night"
4. Reddit: "site:reddit.com San Francisco locals recommend nightlife"
```

### Food/Restaurants
```
1. Google: "best [cuisine] restaurants San Francisco"
2. Google Reviews: "[cuisine] San Francisco reviews"
3. Reddit: "site:reddit.com San Francisco [cuisine] recommendations"
4. TripAdvisor: Restaurant search
```

### Hidden Gems
```
1. Reddit: "site:reddit.com San Francisco hidden gems"
2. Reddit: "site:reddit.com San Francisco locals recommend"
3. Timeout.com: Editorial picks
4. TripAdvisor: Off-the-beaten-path
```

## Why Reddit is Gold 🏆

Reddit provides insights you can't get anywhere else:

**What Locals Actually Say:**
- "Skip the Fisherman's Wharf tourist traps"
- "Go to Tartine Bakery at 7am to avoid lines"
- "The best view is from Twin Peaks at sunset, not Coit Tower"
- "Temple Nightclub is dead on Thursdays, go Friday/Saturday"

**Real Warnings:**
- "Avoid the Tenderloin at night"
- "That restaurant closed last month"
- "Parking is impossible, take Uber"

**Hidden Gems:**
- "There's a secret tiki bar behind the bookshelf at Smuggler's Cove"
- "The best burritos are at La Taqueria, not Chipotle"
- "Free concerts at Stern Grove every Sunday in summer"

## Scraping Patterns

### What We Look For

**Place Names:**
- "I recommend [Place Name]"
- "Check out [Place Name]"
- "[Place Name] is amazing"
- "Try [Place Name]"

**Event Mentions:**
- "[Event Name] - [Date]"
- "[Event Name] | [Venue]"
- "[Day of Week]: [Event Name]"

**Reviews:**
- Star ratings
- "Best [category] in [city]"
- "Must-try: [dish/activity]"

### What We Filter Out

- URLs and links
- Very short mentions (< 3 chars)
- Very long text (> 100 chars for names)
- Generic phrases ("the city", "this place")
- Spam and promotional content

## Data Quality

### High Quality Sources
1. **Reddit** - Real locals, honest opinions
2. **Google Reviews** - Recent, verified experiences
3. **TripAdvisor** - Comprehensive, trusted
4. **Eventbrite/Timeout** - Verified events

### Medium Quality Sources
1. **Google Search** - Hit or miss, depends on query
2. **SeatGeek** - Good for events, limited scope

### Fallback Quality
1. **AI Knowledge** - Good general info, may be outdated
2. **Generic searches** - Better than nothing

## Performance

### Scraping Speed
- Single source: ~2-3 seconds
- Parallel scraping (4 sources): ~4-5 seconds
- Full agentic research: ~50-60 seconds
- Day regeneration: ~10-15 seconds

### Success Rates
- TripAdvisor: ~80% success
- Google Search: ~70% success
- Reddit: ~60% success (but high value)
- Eventbrite: ~50% success
- Yelp: ~0% (blocked by Firecrawl)

## Future Improvements

1. **Direct API Integration**
   - Google Places API (more reliable than scraping)
   - Ticketmaster API (verified events)
   - Yelp Fusion API (if we can get access)

2. **Caching**
   - Cache popular venues per city
   - Cache Reddit recommendations
   - Reduce redundant scraping

3. **Smart Scraping**
   - Learn which sources work best per category
   - Prioritize high-success sources
   - Skip sources that consistently fail

4. **User Feedback**
   - Let users report closed venues
   - Learn from user preferences
   - Improve source selection over time
