# Itinerary Generation Performance Issues

## Current Bottlenecks

The generation is slow because of:

1. **Tavily Scraping** (30-60 seconds)
   - Scrapes 8 URLs: TripAdvisor, Yelp, Reddit, Google, Lonely Planet
   - Each scrape takes 5-10 seconds
   - Runs in batches of 3 to avoid rate limits

2. **Multiple AI Agent Calls** (20-40 seconds)
   - Research Agent: Analyzes scraped data with GPT-4
   - Planner Agent: Creates itinerary with GPT-4
   - Reviewer Agent: Validates and scores with GPT-4

3. **Iteration Loops** (can multiply time by 2-3x)
   - System can loop up to 3 times if quality isn't good enough
   - Each iteration = another Planner + Reviewer call

**Total Time: 1-3 minutes per itinerary**

## Quick Fixes (Choose One or More)

### Option 1: Reduce Scraping Sources (Fastest)
Reduce from 8 sources to 2-3 most reliable ones:
- File: `src/lib/ai/agents/researcher.ts`
- Change `buildSourceUrls()` to only return TripAdvisor + Yelp
- **Saves: 30-40 seconds**

### Option 2: Reduce Max Iterations
Change from 3 iterations to 1:
- File: `src/lib/ai/agents/orchestrator.ts`
- Change `MAX_ITERATIONS = 3` to `MAX_ITERATIONS = 1`
- **Saves: 20-60 seconds (if it was looping)**

### Option 3: Use Faster AI Model
Switch from GPT-4 to GPT-3.5-turbo:
- Files: `researcher.ts`, `planner.ts`, `reviewer.ts`
- Change `openai('gpt-4o')` to `openai('gpt-3.5-turbo')`
- **Saves: 10-20 seconds, but lower quality**

### Option 4: Skip Tavily Entirely (Development Mode)
Use fallback data without scraping:
- File: `src/lib/ai/agents/researcher.ts`
- Comment out the scraping loop
- **Saves: 30-60 seconds, but uses generic data**

### Option 5: Add Loading States & Background Processing
Don't make users wait - generate in background:
- Return immediately with "generating" status
- Use polling or websockets to update when ready
- **User experience improvement, not actual speed**

## Recommended Approach

For immediate improvement:
1. **Reduce scraping sources** (Option 1) - keeps quality high
2. **Reduce iterations to 1** (Option 2) - still gets reviewed once
3. **Add better loading UI** (Option 5) - makes wait feel shorter

This should bring generation time down to **30-60 seconds** with good quality.

## Long-term Solutions

1. **Cache research data** - Store scraped data for popular destinations
2. **Pre-generate common itineraries** - Have templates ready
3. **Use streaming responses** - Show progress as it generates
4. **Parallel agent execution** - Run some agents simultaneously
5. **Use dedicated scraping service** - Pre-scraped database instead of live scraping
