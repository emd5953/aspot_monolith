# AGENTS.md — `src/lib/itinerary`

## Purpose

Persistence, versioning, ownership, and the editing operations applied to an itinerary after generation (drag/reorder, swap, single-day regenerate, revert, cost rollup).

## Ownership

- `itinerary-service.ts` — core read/write for itineraries, days, and activities (`coordsColumns` is the shared coordinate projection used by the generator).
- `version-service.ts` — version snapshots and revert.
- `day-regeneration-service.ts` — single-day regenerate at smaller pipeline scope.
- `ownership.ts` — access checks (who may read/edit a trip's itinerary).
- `share-service.ts` — share codes + plan votes: `ensureShareCode`/`resolveShareCode` mint and resolve the friend-facing link; `castVote`/`getVoteCounts` handle 👍/👎 tallies; `canVoteOnPlan` answers whether a caller may vote (owner, or the itinerary carries a share code).
- `cost.ts` — cost rollup from per-activity estimates.
- `geo.ts` — geographic helpers used for day grouping/pacing.

## Local Contracts

- Every mutating operation must enforce ownership (`ownership.ts`) before touching rows — API routes rely on this layer for authorization, not just the route guard.
- Day regeneration reuses the generation pipeline in `@/lib/ai`; keep the stored shape consistent with `@/lib/ai/schemas/plan.ts`.
- Cost rollup depends on per-activity estimates produced upstream by `@/lib/ai/estimate-cost`.
- Sharing is read-only reach, not membership. Mutations stay owner-only, and votes are reactions rather than governance: the owner keeps sole edit control regardless of tallies.
- **The share code is a capability, not a lookup key.** Migration 018 originally granted every authenticated user SELECT on any itinerary with a non-null `share_code`, which made the code stop being a secret; migration 019 removed those blanket policies. Shared reads now run on the service-role client (`@/lib/supabase/service`) in `/api/shared/[code]` and `/s/[code]`, where the route is the gate — knowing the unguessable code IS the permission. RLS grants no blanket shared-read, so never assume a friend can SELECT a shared row with the user-scoped client.
- Because of that, authorization for shared surfaces lives in the route/service layer, not in a policy. `canVoteOnPlan` must run on the service client for the same reason.

## Work Guidance

- New service behavior ships with a co-located `*.test.ts` (this dir already tests ownership, geo, cost, swap, and the service itself).

## Verification

- `npm test` (Vitest).
