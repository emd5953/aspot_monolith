# Intelligent Context-Aware Scraping

## The Problem

**Before:** Credible mode did generic scraping
```
User: "I want clubbing and sports"
System: Scrapes "San Francisco attractions" (generic)
Result: Gets museums, parks, random stuff
        Misses nightclubs and sports venues
```

**After:** Credible mode understands intent and scrapes precisely
```
User: "I want clubbing and sports"
System: 
  1. Analyzes intent → ["clubbing", "sports"]
  2. Generates targeted queries:
     - "best nightclubs in San Francisco"
     - "sports events San Francisco"
  3. Scrapes those specific searches
Result: Gets actual nightclubs and sports venues
```

## How It Works

### Step 1: Intent Analysis
```typescript
analyzeUserIntent(userPrompt, preferences)
```

**Input:** "keep it in proximity i am feeling a sports game and then clubbing"

**Output:**
```json
{
  "keywords": ["proximity", "sports", "game", "clubbing"],
  "categories": ["sports", "nightlife"],
  "searchQueries": [
    "sports events San Francisco",
    "best nightclubs San Francisco",
    "sports bars San Francisco"
  ],
  "timeOfDay": "night",
  "specificRequests": [
    "watch a sports game",
    "go clubbing"
  ]
}
```

### Step 2: Targeted Scraping
```typescript
scrapeTargetedData(destination, intent, date)
```

For each search query:
1. Builds Google search URL with specific query
2. Scrapes results using Tavily
3. Extracts place names and descriptions
4. Filters by relevance to categories

**Example scraped data:**
```
- 1015 Folsom: Premier nightclub in SoMa district (nightlife)
- Temple Nightclub: Multi-level club with DJ sets (nightlife)
- Oracle Park: Home of SF Giants baseball (sports)
- Chase Center: Warriors basketball arena (sports)
```

### Step 3: Smart Synthesis

AI gets ONLY the relevant scraped places:
```
REAL PLACES (scraped based on user's specific request):
- 1015 Folsom: Premier nightclub in SoMa district (nightlife)
- Temple Nightclub: Multi-level club with DJ sets (nightlife)
- Oracle Park: Home of SF Giants baseball (sports)
- Chase Center: Warriors basketball arena (sports)

User's Request: "sports game and then clubbing"

CRITICAL RULES:
1. Use ONLY these real places
2. Address ALL parts of request (sports AND clubbing)
3. Do NOT invent places
```

## Key Improvements

### 1. Multi-Intent Handling
**Before:** Picked one activity from generic list
**After:** Understands compound requests and addresses each part

### 2. Precise Search Queries
**Before:** "San Francisco attractions"
**After:** "best nightclubs San Francisco", "sports events San Francisco"

### 3. Category-Specific Scraping
**Before:** Scraped TripAdvisor attractions page
**After:** Scrapes Google searches for specific categories

### 4. Fallback Strategy
```
1. Try targeted Google searches
2. If < 3 results, try TripAdvisor fallback
3. If still fails, fall back to fast mode
```

## Example Scenarios

### Scenario 1: "Clubbing and sports"
```
Intent Analysis:
- Keywords: [clubbing, sports]
- Categories: [nightlife, sports]
- Queries: ["nightclubs [city]", "sports events [city]"]

Scraping:
- Query 1: "best nightclubs San Francisco"
  → 1015 Folsom, Temple, Audio
- Query 2: "sports events San Francisco"
  → Oracle Park, Chase Center

Result:
✅ Watch Warriors game at Chase Center
✅ Clubbing at 1015 Folsom
```

### Scenario 2: "Thrift stores and cozy bar"
```
Intent Analysis:
- Keywords: [thrift, stores, cozy, bar]
- Categories: [shopping, nightlife]
- Queries: ["thrift stores [city]", "cozy bars [city]"]

Scraping:
- Query 1: "best thrift stores San Francisco"
  → Crossroads Trading, Buffalo Exchange
- Query 2: "cozy bars San Francisco"
  → Trick Dog, ABV

Result:
✅ Thrift shopping at Crossroads Trading
✅ Drinks at Trick Dog (cozy bar)
```

### Scenario 3: "Stay close, sports, then unwind"
```
Intent Analysis:
- Keywords: [close, proximity, sports, unwind]
- Categories: [sports, relaxation]
- Queries: ["sports venues [city]", "relaxing bars [city]"]

Scraping:
- Finds nearby sports venues
- Finds chill bars/lounges

Result:
✅ Local sports activity
✅ Nearby relaxing bar
```

## Technical Details

### Intent Analysis (GPT-4o-mini)
- Fast (~1-2 seconds)
- Extracts structured data from natural language
- Temperature: 0.3 (more deterministic)

### Targeted Scraping (Tavily)
- 3 queries max (for speed)
- 8 second timeout per query
- Parallel execution possible

### Content Extraction
- Pattern matching for place names
- Filters out non-place content
- Limits to 10 places per query

### Total Time
- Intent analysis: ~1-2s
- Scraping (3 queries): ~10-15s
- AI synthesis: ~5-8s
- **Total: ~20-30s** (same as before but much smarter)

## Configuration

Requires:
```env
TAVILY_API_KEY=your-key
OPENAI_API_KEY=your-key
```

## Future Enhancements

1. **Date-aware scraping** - Check if sports events actually happen on that date
2. **Distance filtering** - When user says "close proximity", filter by distance
3. **Real-time availability** - Check if venues are open on that day
4. **Price validation** - Verify estimated costs against real data
5. **Review integration** - Include ratings/reviews in descriptions
6. **Caching** - Cache scraped data for 24h to speed up similar requests
