# AI Tech Stack

## Overview

The AI agents use a modern, modular stack built on Vercel's AI SDK with OpenAI models and Firecrawl for web scraping.

## Core Technologies

### 1. **Vercel AI SDK** (`ai` package v6.0.49)
- **Purpose:** Unified interface for AI model interactions
- **Features:**
  - `generateText()` - Text generation with streaming support
  - Model-agnostic API (works with OpenAI, Anthropic, etc.)
  - Built-in error handling and retries
  - TypeScript-first design

**Why we use it:**
- Cleaner API than raw OpenAI SDK
- Better TypeScript support
- Easier to switch models if needed
- Built-in streaming for real-time responses

### 2. **OpenAI SDK** (`@ai-sdk/openai` v3.0.18)
- **Purpose:** OpenAI model provider for Vercel AI SDK
- **Models Used:**
  - `gpt-4o` - Main reasoning and synthesis
  - `gpt-4o-mini` - Fast intent analysis and quick tasks

**Model Selection Strategy:**
```typescript
// Strategic/Complex Tasks → GPT-4o
- Agentic Researcher: Planning research strategy
- Agentic Planner: Creating itinerary strategy
- Reviewer: Quality evaluation
- Final Synthesis: Combining scraped data

// Fast/Simple Tasks → GPT-4o-mini
- Intent Analysis: Understanding user prompts
- Quick generation: Fast mode itineraries
```

### 3. **Firecrawl API** (v1)
- **Purpose:** Web scraping as a service
- **Endpoint:** `https://api.firecrawl.dev/v1/scrape`
- **Features:**
  - Converts web pages to clean markdown
  - Handles JavaScript rendering
  - Bypasses anti-scraping measures
  - Returns structured content

**Why we use it:**
- No need to manage headless browsers
- Handles complex sites (TripAdvisor, Google)
- Clean markdown output (easy to parse)
- Reliable and fast

### 4. **Next.js 16** (App Router)
- **Purpose:** Full-stack framework
- **AI Integration:**
  - Server-side AI calls (API routes)
  - Streaming responses
  - Edge runtime support (future)

## Agent Architecture

### Multi-Agent System

```
┌─────────────────────────────────────────────┐
│         Agentic Orchestrator                │
│  (Coordinates all agents, adaptive loops)   │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│Researcher│  │ Planner  │  │ Reviewer │
│  Agent   │  │  Agent   │  │  Agent   │
└──────────┘  └──────────┘  └──────────┘
     │             │             │
     ▼             ▼             ▼
  Firecrawl    GPT-4o        GPT-4o
  + GPT-4o    (Strategy)   (Validation)
```

### Agent Breakdown

#### 1. **Agentic Researcher**
```typescript
// File: src/lib/ai/agents/agentic-researcher.ts
Model: GPT-4o
Temperature: 0.7 (creative but focused)
Tools: Firecrawl API

Responsibilities:
- Creates research plan based on preferences
- Decides which sources to scrape
- Scrapes TripAdvisor, Google Maps, Reddit
- Evaluates data quality
- Requests additional scraping if needed
- Synthesizes findings into structured data

Output:
{
  attractions: [...],
  restaurants: [...],
  activities: [...],
  localInsights: [...],
  sources: [...]
}
```

#### 2. **Agentic Planner**
```typescript
// File: src/lib/ai/agents/agentic-planner.ts
Model: GPT-4o
Temperature: 0.8 (creative planning)

Responsibilities:
- Creates strategic approach for trip
- Decides day themes and pacing
- Builds day-by-day itinerary
- Explains reasoning for each decision
- Avoids duplicate activities
- Balances activity types

Output:
{
  days: [
    {
      dayNumber: 1,
      morning: [...],
      afternoon: [...],
      evening: [...],
      theme: "Arrival & Exploration"
    }
  ]
}
```

#### 3. **Reviewer Agent**
```typescript
// File: src/lib/ai/agents/reviewer.ts
Model: GPT-4o
Temperature: 0.3 (consistent evaluation)

Responsibilities:
- Validates itinerary quality
- Scores 0-100 based on criteria
- Identifies issues (pacing, variety, etc.)
- Suggests improvements
- Checks preference alignment

Output:
{
  score: 85,
  issues: [
    {
      severity: "medium",
      issue: "Too many museums",
      suggestion: "Add outdoor activities"
    }
  ]
}
```

#### 4. **Orchestrator**
```typescript
// File: src/lib/ai/agents/agentic-orchestrator.ts
Model: None (coordination logic)

Responsibilities:
- Coordinates all agents
- Decides when to iterate
- Adaptive stopping (stops at quality threshold)
- Manages reasoning chains
- Handles fallbacks

Flow:
1. Research → 2. Plan → 3. Review
4. If score < 80: Revise and repeat
5. If score ≥ 80: Stop and return
```

## Day Regeneration Stack

### Lightweight Multi-Agent System

```typescript
// File: src/lib/itinerary/day-regeneration-service.ts

Fast Mode:
  GPT-4o-mini → Activities (8-10s)

Credible Mode:
  1. Intent Analysis (GPT-4o-mini)
  2. Agentic Researcher (GPT-4o + Firecrawl)
  3. Targeted Event Scraping (Firecrawl)
  4. Synthesis (GPT-4o)
  Total: 20-30s
```

### Models Used by Task

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Intent Analysis | GPT-4o-mini | 0.3 | Fast, deterministic parsing |
| Research Planning | GPT-4o | 0.7 | Strategic thinking needed |
| Data Synthesis | GPT-4o | 0.7 | Complex reasoning |
| Itinerary Planning | GPT-4o | 0.8 | Creative planning |
| Quality Review | GPT-4o | 0.3 | Consistent evaluation |
| Fast Generation | GPT-4o-mini | 0.8 | Speed over perfection |

## Web Scraping Sources

### Primary Sources (via Firecrawl)

1. **TripAdvisor**
   - Attractions with ratings
   - Restaurant reviews
   - Local tips

2. **Google Search**
   - Targeted queries (e.g., "best nightclubs SF")
   - Date-specific events
   - Local recommendations

3. **Eventbrite**
   - Real events by date
   - Concerts, festivals
   - Local happenings

4. **SeatGeek**
   - Sports schedules
   - Concert tickets
   - Venue information

5. **Reddit** (via Google)
   - Local insider tips
   - Hidden gems
   - Recent recommendations

## API Keys Required

```env
# OpenAI (Required)
OPENAI_API_KEY=sk-...

# Firecrawl (Required for credible mode)
FIRECRAWL_API_KEY=fc-...

# Google Maps (Optional, for map display)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

## Cost Breakdown

### OpenAI Costs (per request)

**Full Itinerary Generation (Agentic Mode):**
- Research: ~$0.05 (GPT-4o, 5K tokens)
- Planning: ~$0.08 (GPT-4o, 8K tokens)
- Review: ~$0.03 (GPT-4o, 3K tokens)
- **Total: ~$0.16 per itinerary**

**Day Regeneration (Credible Mode):**
- Intent: ~$0.001 (GPT-4o-mini, 500 tokens)
- Research: ~$0.05 (GPT-4o, 5K tokens)
- Synthesis: ~$0.02 (GPT-4o, 2K tokens)
- **Total: ~$0.07 per day**

**Day Regeneration (Fast Mode):**
- Generation: ~$0.002 (GPT-4o-mini, 1K tokens)
- **Total: ~$0.002 per day**

### Firecrawl Costs

- ~$0.01 per page scraped
- Typical research: 3-5 pages
- **~$0.03-$0.05 per research session**

### Total Cost Examples

- Fast itinerary: ~$0.01
- Credible day regen: ~$0.10-$0.12
- Full agentic itinerary: ~$0.20-$0.25

## Performance Metrics

| Operation | Mode | Time | Cost |
|-----------|------|------|------|
| Full Itinerary | Fast | 8-10s | $0.01 |
| Full Itinerary | Agentic | 40-60s | $0.20 |
| Day Regen | Fast | 8-10s | $0.002 |
| Day Regen | Credible | 20-30s | $0.12 |

## Technology Choices Explained

### Why Vercel AI SDK over raw OpenAI?
- ✅ Better TypeScript support
- ✅ Unified API for multiple providers
- ✅ Built-in streaming
- ✅ Easier error handling
- ✅ Future-proof (can switch to Claude, etc.)

### Why GPT-4o over GPT-4-turbo?
- ✅ Faster (2x speed)
- ✅ Cheaper (50% cost)
- ✅ Better at structured output
- ✅ Multimodal (future: image analysis)

### Why Firecrawl over Puppeteer?
- ✅ No infrastructure to manage
- ✅ Handles anti-scraping automatically
- ✅ Clean markdown output
- ✅ Reliable and fast
- ❌ Costs money (vs free Puppeteer)

### Why GPT-4o-mini for some tasks?
- ✅ 10x cheaper than GPT-4o
- ✅ 2x faster
- ✅ Good enough for simple tasks
- ✅ Reduces overall costs significantly

## Future Enhancements

### Potential Additions

1. **Claude 3.5 Sonnet** (via AI SDK)
   - Better reasoning for complex planning
   - Longer context window
   - More creative suggestions

2. **Perplexity API**
   - Real-time web search
   - Better than Firecrawl for some queries
   - Built-in citations

3. **LangChain**
   - More sophisticated agent orchestration
   - Built-in memory/state management
   - Tool calling framework

4. **Vector Database** (Pinecone/Weaviate)
   - Cache scraped data
   - Semantic search for similar trips
   - Personalization over time

5. **Function Calling**
   - Structured tool use
   - Better than prompt engineering
   - More reliable outputs

## Code Examples

### Using Vercel AI SDK

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Your prompt here',
  temperature: 0.7,
});

console.log(result.text);
```

### Using Firecrawl

```typescript
const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
  },
  body: JSON.stringify({
    url: 'https://example.com',
    formats: ['markdown'],
    onlyMainContent: true,
  }),
});

const data = await response.json();
const markdown = data.data.markdown;
```

## Dependencies

```json
{
  "ai": "^6.0.49",                    // Vercel AI SDK
  "@ai-sdk/openai": "^3.0.18",        // OpenAI provider
  "@supabase/supabase-js": "^2.91.1", // Database
  "next": "16.1.4",                   // Framework
  "zod": "^4.3.6"                     // Schema validation
}
```

## Environment Setup

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.local.example .env.local

# Add your keys
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...

# Run dev server
npm run dev
```

## Monitoring & Debugging

### Logging
All agents log their reasoning steps:
```typescript
console.log('[Agent] Thought:', step.thought);
console.log('[Agent] Action:', step.action);
console.log('[Agent] Result:', step.result);
```

### Performance Tracking
```typescript
const startTime = Date.now();
// ... operation ...
console.log(`Completed in ${(Date.now() - startTime) / 1000}s`);
```

### Error Handling
```typescript
try {
  const result = await runAgenticResearcher(...);
} catch (error) {
  console.error('Research failed:', error);
  // Fallback to fast mode
  return await generateFastMode(...);
}
```
