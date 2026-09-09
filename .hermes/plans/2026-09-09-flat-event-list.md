# Flat event list — remove days and scheduling

**Goal:** Spotz stops *scheduling* and starts *selecting*. One prompt returns one flat, ranked list of real events for one night, ordered by each event's own start time from Partiful/Posh/Luma. No day buckets, no morning/afternoon/evening, no invented clock times, no multi-day trips.

**Architecture:** The pipeline collapses from "research → partition into days → schedule into buckets → audit the schedule → repair the schedule → review" down to "research → rank → order by start time". Most of the removed code is deleted rather than rewritten, because the defects it detects and repairs (backwards clocks, empty buckets, missing meals, per-day geographic sprawl) cannot occur when nothing is being scheduled.

**Tech Stack:** unchanged — Next.js/TS, Zod, Supabase, Vitest.

---

## The finding that shapes this whole spec

`src/lib/ai/pool-events.ts:poolRowToActivity` currently **discards the real start time**:

```ts
const when = fmtTime(row.starts_at);          // "9:30 PM"
description: [..., when ? `Starts ${when}` : undefined, ...].join(' — '),
bestTime: 'evening',                           // hardcoded
duration: 120,                                 // hardcoded
```

`starts_at` is a real `TIMESTAMPTZ` on `candidate_events`, and it is flattened into an English fragment inside a description string, then thrown away as structured data. The planner then *re-invents* a clock time for the event it already knew the time of.

**So the ordering signal this product now depends on does not currently survive into the pipeline.** Step 1 is making `startsAt` a first-class field. Nothing else works until that lands.

## Goals / Non-goals

**Goals**
- One itinerary = one night = one flat ordered list of plans.
- Every plan's time is the event's *real* published start time, or absent. Never invented.
- Ordering is by `startsAt` ascending; plans with no known time sort last, stable by rank.
- Delete the scheduling machinery outright rather than porting it.
- One generation pipeline. Fast and Deep stop being two orchestrators.

**Non-goals**
- No change to the source connectors, the ingest cron, or the `candidate_events` pool.
- No change to sharing/voting, auth, or the share-code capability model.
- No new UI beyond what removing the day timeline forces.
- Not touching the `itinerary_days` DB table in this pass (see Strategy A below).

## Design

### Step 1 — carry the real time (`pool-events.ts`, `agents/types.ts`)

Add to `ActivityData`:

```ts
/** Real published start time (ISO, from candidate_events.starts_at). Absent when the source gave none. */
startsAt?: string;
/** Real published end time. Absent when unknown — never inferred. */
endsAt?: string;
```

`poolRowToActivity` sets `startsAt: row.starts_at ?? undefined` and stops hardcoding `bestTime`/`duration`. Keep the human-readable "Starts 9:30 PM" in the description — it is good prompt context — but the structured field is now the source of truth.

Web-research candidates (Tavily) have no start time. They keep `startsAt` absent and sort last. That is correct: a bar with no event attached is a fallback option, not a timed Move.

### Step 2 — the plan shape (`schemas/plan.ts`, `agents/types.ts`)

`ItineraryPlanSchema` loses `days`. New shape:

```ts
export const PlanItemSchema = z.object({
  name: z.string(),
  type: z.string(),                     // normalizeItemType keeps mapping model output
  startsAt: z.string().optional(),      // ISO. Pipeline-stamped from the pool, NOT model-authored.
  description: z.string().optional(),
  matchScore: z.number().optional(),
  matchReasons: z.array(z.string()).optional(),
  source: z.string().optional(),
});

export const ItineraryPlanSchema = z.object({
  summary: z.string(),
  plans: z.array(PlanItemSchema).min(1),
  totalEstimatedCost: z.string().optional().default('Varies'),
  importantNotes: z.array(z.string()).optional().default([]),
});
```

Gone: `DayPlanSchema`, `SingleDaySchema`, `PlanningStrategySchema.dayThemes`, `ScheduledItemSchema.time`, `.duration`.

**`startsAt` is never model-authored.** The model selects and orders by fit; the orchestrator stamps the real time by matching the pick back to the pool (same mechanism `provenance.ts` already uses for `source`). This preserves the core principle — the system never invents facts about a venue — and it is the reason the model cannot produce a wrong time: it is not asked for one.

### Step 3 — delete the scheduling layer

| File | Lines | Disposition |
|---|---|---|
| `agents/plan-audit.ts` | 586 | **Delete.** Every check is about scheduling: backwards clocks, empty buckets, missing lunch/dinner, per-day geo spread, day overflow. Keep ONLY `duplicate venue` and `off-pool ratio` — move both into a new ~60-line `agents/plan-check.ts`. |
| `agents/plan-repair.ts` | 499 | **Delete.** It repairs the defects above. The one survivor (drop a duplicate venue) folds into `plan-check.ts`. |
| `agents/pool-partition.ts` | 346 | **Delete.** Geo-clustering exists to stop a *day* crisscrossing the city. One list, ordered by time, has no days to cluster. |
| `ai/schedule-times.ts` | 79 | **Delete.** Assigning clock times is the thing we are removing. |
| `itinerary/day-regeneration-service.ts` | 769 | **Delete.** "Regenerate day N" is meaningless with one list. Its route goes too. |
| `components/itinerary/day-schedule.tsx` | 214 | **Delete.** Replaced by a flat list in `itinerary-view.tsx`. |
| `agents/orchestrator.ts` (classic) | ~250 | **Delete.** One pipeline (see Step 4). |

Net: roughly **2,700 lines deleted**, ~200 added.

### Step 4 — one pipeline

Today: Fast → `runOrchestrator` (fixed 3-iteration loop), Deep → `runAgenticOrchestrator` (up to 5 iterations + advanced curation + email).

Both loops exist to re-plan a bad *schedule*. With no schedule, iteration mostly re-rolls a ranking. Collapse to a single `runPipeline` in `agents/pipeline.ts`:

```
research (cached) + pool events → curate by intent → select+rank (1 LLM call) → stamp times/provenance → order by startsAt
```

Fast vs Deep survives as a **delivery** distinction, which is what users actually experience:
- Fast: awaited, streams to screen.
- Deep: `waitUntil` background + email, and `useAdvancedCuration` (wider Tavily scrape, bigger pool). Same single pipeline, more input.

`reviewer.ts` is kept but demoted to one optional pass gated on Deep — it can still catch "these five picks are all the same vibe", which is a judgement call, not a mechanical one.

### Step 5 — persistence (Strategy A, no migration)

**Do not touch the DB in this pass.** `plans.day_id` is `NOT NULL` and FK-cascades from `itinerary_days`, with RLS routed through it. Changing that is a migration + policy rewrite + data migration, and it buys nothing the user can see.

Instead: `saveItineraryToDatabase` creates **exactly one** `itinerary_days` row per itinerary (`day_number: 1`, `date: the night`) and hangs every plan off it, ordered by `sort_order`. The day row becomes an invisible implementation detail — no code above persistence knows it exists, and no UI renders it.

`plans.start_time` (a `TIME` column) stores the real time when known, `NULL` when not — it already allows null.

A later migration can flatten `itinerary_days` away once nothing above it references days. That is a separate, lower-risk change *because* of this ordering.

### Step 6 — UI

`itinerary-view.tsx` renders one ordered list. Each row: time (or nothing), name, neighborhood, source badge, vote chips. `day-schedule.tsx` and the day-regenerate modal go.

**Manual reorder stays.** The user can drag plans into their own order after generation, so:
- `plans.sort_order` remains the rendered order and stays user-editable.
- `edit-day-modal.tsx` becomes `edit-plan-modal.tsx` (edit one plan).
- The reorder path survives with a small signature change. `reorderActivities` (`itinerary-service.ts:221`) already takes `dayId` and **never reads it** — it rewrites `sort_order` purely by array position. So the day argument is vestigial: drop it from the function and from the `/activities/reorder` route body (which currently requires `dayId`), and the reorder logic itself needs no change at all.
- The `[id]/activities/move` route (move a plan *between days*) is deleted; there is one list to move within.
- `reorderActivities` also returns `conflicts?: TimeConflict[]` from overlap detection between assigned slots. With real published times that the user cannot edit, two events genuinely can overlap and that is not an error — it is a choice the user is making. Drop the conflict return.

This makes `startsAt` ordering a **default, not a constraint**: the pipeline seeds `sort_order` by start time, and any manual drag overrides it permanently. Once a user has reordered, generation-time ordering never silently re-asserts itself — a re-sort would throw away their intent. Regeneration produces a new plan set with fresh seeded order, which is a new list, not a reshuffle of theirs.

`.ics` export (`calendar/ics.ts`): keep, simplify — one VEVENT per plan that has a real `startsAt`, skip the ones that don't. It gets *simpler*, since the all-day fallback existed for untimed day-planned items.

## Behavior

**Generate.** Prompt → parse intent → pull tonight's pool (`getTonightPool`, already NYC/time-windowed) + cached web research → curate by intent → one LLM call selects and ranks ~5-8 plans with reasons → pipeline stamps `startsAt` + `source` from the pool → sort by `startsAt` (unknown last) → persist → render.

**Ordering.** `startsAt` ascending. Ties keep rank order. Unknown-time plans go last, ranked. This is deterministic and testable without a model.

**What a user loses:** nothing they had. Days were always 1. Clock times were invented and frequently wrong (the audit had a *backwards clock* check because the planner produced them). Meal-slot logic put dinner in a plan for a night out.

**What they gain:** times that are true, because they come from the event listing.

## Verification

- `npx vitest run` green. Tests for deleted modules are deleted with them.
- **New:** `pool-events.test.ts` — `startsAt` survives the row→ActivityData conversion, absent when `starts_at` is null.
- **New:** `pipeline.test.ts` — ordering: timed events ascending, untimed last, ties stable.
- `src/test/quality`: the eval suite measures *scheduling* quality (empty buckets, day geo spread, meal coverage). Most baselines become meaningless. **Rewrite it** to measure what now matters: pool→plan yield, off-pool (invented) ratio, duplicate rate, and how many picks carry a real `startsAt`. Keep the anti-gaming property — a pass that ships fewer plans must not score higher.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Manual: generate a plan, confirm times shown match the source listings (spot-check two against Partiful/Posh directly).

## Risks / open questions

- **The eval suite is the real cost.** It is the only thing standing between this rewrite and silent quality regression, and its current baselines do not survive. Rewriting it is in scope, not optional — without it, "did this get worse?" becomes unanswerable.
- **Existing itineraries.** Rows persist with `day_number: 1` and read fine under Strategy A. Any row with `day_number > 1` (pre-pivot leftovers) would render only its first day. **Check before shipping:** `select count(*) from itinerary_days where day_number > 1;` — expected 0.
- **Deleting `plan-audit` deletes real bug-catchers.** The duplicate-venue and off-pool checks are genuinely load-bearing (the AGENTS.md documents an LLM reviewer scoring 92/100 for a plan that booked one venue twice). They MUST survive into `plan-check.ts` — this is the one part of the deletion that is not safe to do carelessly.
- **Open:** with no reviewer loop on Fast, is one LLM call enough for quality? Mitigation: the pool is pre-curated by intent, so the model is choosing from an already-good set.
- Deferred, unchanged: TikTok connector (priority #4), "pie" as a source.

## Milestones

1. **Carry the time.** `startsAt`/`endsAt` on `ActivityData`, `poolRowToActivity` stops discarding it, test. Nothing else changes — pipeline ignores the new field. Ships green on its own.
2. **New plan shape + pipeline.** `PlanItemSchema`, `agents/pipeline.ts`, `plan-check.ts` (duplicate + off-pool salvaged). Generator writes one day row. Old orchestrators still present but unreferenced.
3. **Delete.** Remove audit/repair/partition/schedule-times/day-regeneration/both orchestrators/day-schedule + their tests and routes.
4. **UI + evals.** Flat list render, reorder path de-dayed (`reorderActivities` loses its unused `dayId`, conflict detection dropped), `edit-plan-modal`, `.ics` simplification, rewritten quality suite with fresh measured baselines.

Each milestone leaves the repo green and committable.
