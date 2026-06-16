# AGENTS.md — `src/lib/itinerary`

## Purpose

Persistence, versioning, ownership, and the editing operations applied to an itinerary after generation (drag/reorder, swap, single-day regenerate, revert, cost rollup).

## Ownership

- `itinerary-service.ts` — core read/write for itineraries, days, and activities (`coordsColumns` is the shared coordinate projection used by the generator).
- `version-service.ts` — version snapshots and revert.
- `day-regeneration-service.ts` — single-day regenerate at smaller pipeline scope.
- `ownership.ts` — access checks (who may read/edit a trip's itinerary).
- `cost.ts` — cost rollup from per-activity estimates.
- `geo.ts` — geographic helpers used for day grouping/pacing.

## Local Contracts

- Every mutating operation must enforce ownership (`ownership.ts`) before touching rows — API routes rely on this layer for authorization, not just the route guard.
- Day regeneration reuses the generation pipeline in `@/lib/ai`; keep the stored shape consistent with `@/lib/ai/schemas/plan.ts`.
- Cost rollup depends on per-activity estimates produced upstream by `@/lib/ai/estimate-cost`.

## Work Guidance

- New service behavior ships with a co-located `*.test.ts` (this dir already tests ownership, geo, cost, swap, and the service itself).

## Verification

- `npm test` (Vitest).
