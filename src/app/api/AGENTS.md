# AGENTS.md — `src/app/api`

## Purpose

Next.js App Router route handlers. Thin HTTP layer over `@/lib`: authenticate, authorize, delegate, shape the JSON response.

## Ownership

- Route groups: `auth/`, `itinerary/`, `plans/`, `shared/`, `ingest/`.
- Itinerary sub-routes own the editing surface: `[id]/activities` (add, `reorder`, `[activityId]`), `[id]/versions`, `[id]/revert`, `[id]/regenerate`, `[id]/status`, `[id]/calendar`, `[id]/email`, `[id]/share` (mint the friend link).
- `plans/[planId]/vote` — 👍/👎 on an individual plan (owner or share-link friend). Visibility is checked in the route via `canVoteOnPlan` on the service client, NOT by RLS: `plan_votes_insert` only asserts `auth.uid() = user_id`, so without the check any signed-in user could vote on an arbitrary plan UUID. Unknown or unshared plans return `404`.
- `shared/[code]` — read a shared itinerary + its vote tallies by share code. Authenticates with the user client (identity, for `mine` votes and `isOwner`) but reads with the service-role client: the unguessable code is the capability and this route is the gate. See `@/lib/itinerary/AGENTS.md`.
- `ingest/` — cron-secret-gated, service-role only. NOT user-facing: runs the source connectors (`@/lib/sources`) and refreshes the `candidate_events` pool. Responds `200` only when every source succeeded; a partial run is `207` with `failedSources` (and `expiryError` when pool expiry fails), so a dead connector cannot hide behind a green cron.
- `auth/callback` — OAuth/email exchange. Honors `?next=` so the `/s/<code>` share flow survives sign-in; only same-origin paths are accepted, since the value is attacker-supplied and would otherwise be an open redirect.
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
- Authorize resource access through `@/lib/itinerary/ownership` — never trust an id from the request alone.
- Two routes deliberately break the single-client pattern and read with `@/lib/supabase/service`: `ingest/` (no user at all) and the share surfaces (`shared/[code]`, and the vote permission check). Where the service client is used, the ROUTE owns authorization — RLS is not a second net behind it. Never reach for it elsewhere.
- Keep business logic out of routes; call into `@/lib`. Routes orchestrate request/response only.
- Wrap handlers in try/catch, `console.error` the cause, return a generic message with a `500`.
- Deep-mode background work uses `waitUntil` (`@vercel/functions`); the request returns immediately and email is delivered later.

## Work Guidance

- Validate request bodies with Zod before delegating.

## Verification

- `npm run lint`, `npm run build` (route type-checking), and `npm test` for the underlying `@/lib` logic.
