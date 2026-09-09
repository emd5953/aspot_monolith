# AGENTS.md — `src/app/api`

## Purpose

Next.js App Router route handlers. Thin HTTP layer over `@/lib`: authenticate, authorize, delegate, shape the JSON response.

## Ownership

- Route groups: `auth/`, `itinerary/`, `plans/`, `shared/`, `ingest/`, `maps/`.
- Itinerary sub-routes own the editing surface: `[id]/days`, `[id]/activities` (move/reorder/[activityId]), `[id]/versions`, `[id]/revert`, `[id]/regenerate`, `[id]/days/[dayId]/regenerate`, `[id]/status`, `[id]/calendar`, `[id]/email`, `[id]/share` (mint the friend link).
- `plans/[planId]/vote` — 👍/👎 on an individual plan (any signed-in user who can see it, owner or share-link friend).
- `shared/[code]` — read a shared itinerary + its vote tallies by share code.
- `ingest/` — cron-secret-gated, service-role only. NOT user-facing: runs the source connectors (`@/lib/sources`) and refreshes the `candidate_events` pool. The only route in this tree using the Supabase service-role client instead of the user-scoped one.
- Generation: `itinerary/generate` — Fast mode (awaited, returns the itinerary) and Deep mode (`waitUntil` background run + email). The single generation entry point.

## Local Contracts

Every handler follows the house pattern:

```ts
const supabase = await createClient();            // @/lib/supabase/server
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// ...delegate to @/lib, then return NextResponse.json(...)
```

- Always authenticate with `auth.getUser()` and return `401` on failure.
- Authorize resource access through `@/lib/itinerary/ownership` (or the equivalent trips check) — never trust an id from the request alone.
- Keep business logic out of routes; call into `@/lib`. Routes orchestrate request/response only.
- Wrap handlers in try/catch, `console.error` the cause, return a generic message with a `500`.
- Deep-mode background work uses `waitUntil` (`@vercel/functions`); the request returns immediately and email is delivered later.

## Work Guidance

- Validate request bodies with Zod before delegating.

## Verification

- `npm run lint`, `npm run build` (route type-checking), and `npm test` for the underlying `@/lib` logic.
