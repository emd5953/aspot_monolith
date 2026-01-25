# Real-Time Progress Updates

## Current Status

The loading screen currently shows **fake progress steps** that cycle on a timer. However, the infrastructure for **real progress tracking** has been implemented and is ready to use.

## What's Real vs Fake

### Currently Real ✅
- **Destination facts** - Real facts from a database of 30+ cities
- **Time-based encouragement messages** - Based on actual elapsed time
- **Progress bar** (when enabled) - Shows actual completion percentage

### Currently Fake ⏱️
- **Progress steps** - Cycle through predefined steps on an 8-second timer
- Don't reflect what's actually happening in the backend

## How to Enable Real Progress

### Backend (Already Implemented)

The itinerary generator already supports progress callbacks:

```typescript
// src/lib/ai/itinerary-generator.ts
export async function generateItinerary(
  supabase: SupabaseClient,
  input: ItineraryInput,
  preferences: UserPreferences,
  useAgenticMode: boolean = false,
  useTrulyAgentic: boolean = false,
  useAdvancedCuration: boolean = false,
  onProgress?: ProgressCallback // ← Progress callback
): Promise<GeneratedItinerary>
```

Progress is emitted at key stages:
- `starting` - Initialization (0%)
- `researching` - Gathering destination data (10-20%)
- `planning` - Creating itinerary (50%)
- `reviewing` - Quality check (70%)
- `generating` - Fast mode generation (30%)
- `saving` - Saving to database (95%)
- `complete` - Done (100%)

### Streaming API (Already Created)

A Server-Sent Events endpoint is available:

```
POST /api/itinerary/generate-stream
```

This streams progress updates in real-time using SSE.

### Frontend Component (Ready)

The `KanyeQuotes` component accepts a `realProgress` prop:

```typescript
<KanyeQuotes 
  destination={destination} 
  realProgress={realProgress} // ← Pass real progress here
/>
```

When `realProgress` is provided:
- Shows real status messages
- Displays actual progress bar
- Uses appropriate emojis for each stage

## To Switch to Real Progress

### Option 1: Use Streaming Endpoint (Recommended)

Update `src/app/(protected)/itinerary/page.tsx`:

```typescript
const handleGenerate = async (data) => {
  setIsGenerating(true);
  setRealProgress({ status: 'starting', message: 'Initializing...', progress: 0 });
  
  try {
    const res = await fetch('/api/itinerary/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.status === 'done') {
            router.push(`/itinerary/${data.itinerary.id}`);
            return;
          } else if (data.status === 'error') {
            throw new Error(data.message);
          } else {
            setRealProgress(data);
          }
        }
      }
    }
  } finally {
    setIsGenerating(false);
  }
};
```

### Option 2: Polling (Simpler but less real-time)

Keep using the regular endpoint but poll for status:

```typescript
const handleGenerate = async (data) => {
  setIsGenerating(true);
  
  // Start generation
  const res = await fetch('/api/itinerary/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // Poll for progress (if you add a status endpoint)
  const pollInterval = setInterval(async () => {
    const statusRes = await fetch(`/api/itinerary/status/${jobId}`);
    const status = await statusRes.json();
    setRealProgress(status);
  }, 1000);

  const { itinerary } = await res.json();
  clearInterval(pollInterval);
  router.push(`/itinerary/${itinerary.id}`);
};
```

## Progress Messages by Mode

### Fast Mode (5-12s)
1. Starting (0%)
2. Generating (30%)
3. Finalizing (80%)
4. Saving (95%)
5. Complete (100%)

### Standard Agentic Mode (45-70s)
1. Starting (0%)
2. Researching destination (15%)
3. Finding restaurants (25%)
4. Mapping routes (50%)
5. Checking availability (70%)
6. Personalizing (85%)
7. Saving (95%)
8. Complete (100%)

### Truly Agentic Mode (60-90s)
1. Starting (0%)
2. Researching attractions (20%)
3. Creating itinerary (50%)
4. Optimizing schedule (70%)
5. Finalizing details (90%)
6. Saving (95%)
7. Complete (100%)

## Benefits of Real Progress

1. **User confidence** - Users see actual progress, not fake steps
2. **Transparency** - Users know what's happening behind the scenes
3. **Better UX** - Progress bar shows actual completion
4. **Debugging** - Easier to identify where generation is slow

## Why Keep Fake Progress?

For now, fake progress is simpler and works well because:
- No need for SSE infrastructure
- No additional API calls
- Users are entertained by destination facts
- Generation is fast enough (<60s) that fake progress is acceptable

## Recommendation

- **Keep fake progress for now** - It works well and is simple
- **Switch to real progress** when you want to:
  - Support very long generations (>2 minutes)
  - Give users more transparency
  - Debug performance issues
  - Provide cancellation functionality

The infrastructure is ready whenever you want to make the switch!
