# AGENTS.md — `src/lib/itinerary`

## Purpose

Persistence, versioning, ownership, and the editing operations applied to a Move-list after generation (manual reorder, revert, cost rollup).

## Ownership

- `itinerary-service.ts` — core read/write for itineraries and plans (`coordsColumns` is the shared coordinate projection used by the generator). `reorderActivities` sets `sort_order` from array position — the user's own arrangement, which overrides the start-time order generation seeded.
- `version-service.ts` — version snapshots and revert.
- `ownership.ts` — access checks (who may read/edit a trip's itinerary).
- `share-service.ts` — share codes + plan votes: `ensureShareCode`/`resolveShareCode` mint and resolve the friend-facing link; `castVote`/`getVoteCounts` handle 👍/👎 tallies; `canVoteOnPlan` answers whether a caller may vote (owner, or the itinerary carries a share code).
- `cost.ts` — cost rollup from per-activity estimates.
- `geo.ts` — geographic helpers.

## Local Contracts

- Every mutating operation must enforce ownership (`ownership.ts`) before touching rows — API routes rely on this layer for authorization, not just the route guard.
- A Spotz itinerary is ONE night: one flat list of plans in `sort_order`. The DB still nests them under a single `itinerary_days` row to satisfy `plans.day_id NOT NULL`; that row is an implementation detail. Read `StoredItinerary.plans`, never `.days`.
- No overlap/conflict detection on reorder. The times shown are the ones each venue published and the user cannot edit them, so two events overlapping is a real choice, not a defect to warn about.
- Cost rollup depends on per-activity estimates produced upstream by `@/lib/ai/estimate-cost`.
- Sharing is read-only reach, not membership. Mutations stay owner-only, and votes are reactions rather than governance: the owner keeps sole edit control regardless of tallies.
- **The share code is a capability, not a lookup key.** Migration 018 originally granted every authenticated user SELECT on any itinerary with a non-null `share_code`, which made the code stop being a secret; migration 019 removed those blanket policies. Shared reads now run on the service-role client (`@/lib/supabase/service`) in `/api/shared/[code]` and `/s/[code]`, where the route is the gate — knowing the unguessable code IS the permission. RLS grants no blanket shared-read, so never assume a friend can SELECT a shared row with the user-scoped client.
- Because of that, authorization for shared surfaces lives in the route/service layer, not in a policy. `canVoteOnPlan` must run on the service client for the same reason.

## Work Guidance

- New service behavior ships with a co-located `*.test.ts` (this dir already tests ownership, geo, cost, swap, and the service itself).

## Verification

- `npm test` (Vitest).
