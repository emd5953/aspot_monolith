# Strip trip-planner leftovers Implementation Plan

**Goal:** Remove remaining aSpot (multi-day trip planner) shape/complexity that survived the Spotz pivot — a quiz-shaped preference profile, destination/weather fields, and (biggest) the multi-day `days[]` model — so the code matches what the product actually does: one night, one plan, sourced from Partiful/Posh/Luma.

**Architecture:** Three independent slices, ordered cheapest/safest first. Slices 1–2 are pure TypeScript-layer cleanup (no DB migration — verified below that nothing DB-backed depends on them). Slice 3 is a real schema change and is scoped as a separate go/no-go decision at the end of this plan, not bundled into the same PR.

**Tech Stack:** Next.js/TS, Zod, Supabase/Postgres, Vitest.

---

## Context / what's already clean

Migration `016_spotz_pivot.sql` already dropped `quiz_progress`, `trips`, `trip_members`, `rsvps`, `votes`, `suggestions`, `notification_preferences`, `notifications`, and — important — **`user_preferences` itself**. So `UserPreferences` (`src/types/profile.ts`) is **not DB-backed today**: `defaultPreferencesFor(userId)` fabricates one in memory per request from `DEFAULT_PREFERENCES`, nothing reads or writes a `user_preferences` row. That means Slice 1 below is a pure type/logic cleanup — no migration required.

`quiz/` and `trips/` component directories don't exist (already removed). No `quiz_progress`/`trips` code references found (`search_files` returned 0 hits for both).

## Slice 1 — Strip quiz-shaped `UserPreferences` fields

**Objective:** Remove `travelMotivations`, `cuisinePreferences`, `authenticityPreference`, `rawAnswers` — fields that exist only because nothing ever sets them (no quiz), so every scoring branch that reads them is permanently a no-op.

**Files:**
- Modify: `src/types/profile.ts` (interface + `DEFAULT_PREFERENCES` + `defaultPreferencesFor`)
- Modify: `src/lib/preferences/score-research.ts:171,196-197,223,257-258,277` (the 4 scoring branches that read these fields)
- Modify: `src/lib/preferences/score-research.test.ts` (any fixtures using the removed fields)
- Check: `grep -rn "travelMotivations\|cuisinePreferences\|authenticityPreference\|rawAnswers" src/` for anything missed

**Step 1: Read current `score-research.ts` scoring logic**

Read the file in full and confirm exactly which functions use each field (`scoreActivity`/`scoreRestaurant`-style functions, based on the earlier grep: lines ~171, ~196-197, ~223, ~257-258, ~277).

**Step 2: Decide replacement behavior per branch, not just delete**

For each branch, the field always evaluates falsy/empty today (since `DEFAULT_PREFERENCES` ships them empty and nothing overrides them), so removing the branch changes nothing observable — confirm this with `git log -p` or by reading `defaultPreferencesFor` call sites to make sure no caller ever constructs a `UserPreferences` with these fields populated. If a caller DOES populate them, stop and flag it — the removal is not a no-op.

**Step 3: Remove the fields from the type**

```ts
// src/types/profile.ts
export interface UserPreferences {
  id: string;
  userId: string;
  planningStyle: string;
  timeRhythm: string;
  comfortZone: number;
  activityTypes: string[];
  budgetRange: string;
  travelPace: string;
  socialPreferences: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Remove `travelMotivations`, `cuisinePreferences`, `authenticityPreference`, `rawAnswers` from the interface, `DEFAULT_PREFERENCES`, and update the file's header comment (it already documents "no quiz" — tighten it to say the type carries no quiz-shaped fields at all now).

**Step 4: Remove the dead scoring branches in `score-research.ts`**

Delete the `if (prefs.authenticityPreference === ...)`, `prefs.travelMotivations`, `prefs.cuisinePreferences` blocks identified in Step 1. Leave the surrounding scoring logic (activityTypes, budgetRange, etc.) untouched.

**Step 5: Fix compile errors**

Run `npx tsc --noEmit` and fix every call site that constructs a `UserPreferences` literal or destructures the removed fields (expect hits in test fixtures only, based on the earlier search).

**Step 6: Run tests**

Run: `npx vitest run src/lib/preferences/score-research.test.ts`
Expected: all pass, possibly after trimming fixture fields.

Run: `npx vitest run` (full suite)
Expected: 445 (or current count) passed, 0 failed.

**Step 7: Commit**

```bash
git add src/types/profile.ts src/lib/preferences/score-research.ts src/lib/preferences/score-research.test.ts
git commit -m "refactor(profile): drop quiz-shaped UserPreferences fields (always no-ops, no quiz feeds them)"
```

---

## Slice 2 — Strip destination/weather fields

**Objective:** `DestinationData`/`Attraction`/`Restaurant`/`ActivityOption` in `src/types/destination.ts` carry a `country` field and a whole `WeatherInfo` shape (`averageTemp`, `climate`, `bestMonths`, `rainyMonths`) — irrelevant when the destination is always "New York City" and the window is always tonight.

**Files:**
- Modify: `src/types/destination.ts` (remove `WeatherInfo` interface, `weatherInfo` field, `country` field)
- Modify: `src/lib/ai/tavily-service.ts` (stop populating `weatherInfo`/`country` — check `fetchDestinationDataWithPrefs`/`fetchDestinationData` construction of `DestinationData`)
- Check: `src/lib/ai/agents/agentic-researcher.ts`, `src/lib/ai/agents/researcher.ts` (both call `fetchDestinationDataWithPrefs` — confirm neither reads `.country` or `.weatherInfo` downstream)
- Check: `src/lib/ai/agents/types.ts`, `src/lib/ai/itinerary-generator.ts` for any `.country`/`.weatherInfo` reads

**Step 1: Grep for actual consumers**

```bash
grep -rn "\.weatherInfo\|weatherInfo:" src/ --include='*.ts' --include='*.tsx'
grep -rn "destination\.country\|\.country\b" src/lib/ai src/app --include='*.ts' --include='*.tsx'
```
Confirm nothing outside `destination.ts`/`tavily-service.ts` reads these — if the UI or email template surfaces `country` anywhere, stop and report before deleting.

**Step 2: Remove from the type**

```ts
// src/types/destination.ts — delete WeatherInfo interface entirely,
// delete `country: string;` and `weatherInfo?: WeatherInfo;` from DestinationData
```

**Step 3: Remove the population code in `tavily-service.ts`**

Find where `DestinationData` is constructed (`fetchDestinationDataWithPrefs`) and delete whatever sets `country`/`weatherInfo` (likely a hardcoded `'USA'`/`'United States'` and/or a weather lookup call — read the file first to see if there's a weather-fetching helper that becomes fully dead once this field is gone, and delete that helper too if so).

**Step 4: Fix compile errors, run tests**

```bash
npx tsc --noEmit
npx vitest run
```

**Step 5: Commit**

```bash
git add src/types/destination.ts src/lib/ai/tavily-service.ts
git commit -m "refactor(destination): drop country/weather fields — NYC-only, no destination concept"
```

---

## Slice 3 — Collapse `days[]` to single-night (SEPARATE GO/NO-GO — do not start without explicit approval)

**Objective:** Every itinerary is one night in NYC, but the schema still models an N-day trip: `ItineraryPlanSchema.days: array.min(1)`, DB tables `itineraries` → `itinerary_days` (1:N, `day_number`/`date` columns) → `plans` (renamed from `activities`), plus `packingTips`/`totalEstimatedCost` framed as whole-trip fields.

**Why this is scoped separately:** ~50 files reference `days`/`day_number`/`dayNumber`, including:
- DB schema back to `001_initial_schema.sql` (`itinerary_days` table, FK cascade from `plans`, unique constraint `(itinerary_id, day_number)`)
- RLS policies keyed through `itinerary_days`
- `src/lib/itinerary/itinerary-service.ts`, `version-service.ts`, `day-regeneration-service.ts`, `cost.ts`, `geo.ts`, `share-service.ts`
- `src/lib/ai/schemas/plan.ts`, `agents/*.ts` (orchestrators, planner, reviewer, pool-partition)
- `src/lib/calendar/ics.ts` (multi-day .ics export)
- `src/app/api/itinerary/[id]/days/[dayId]/regenerate` route (day-level regenerate — would need to become itinerary-level)
- UI: `itinerary-view.tsx`, `day-schedule.tsx`, `edit-day-modal.tsx`, `regenerate-modal.tsx`

This is a real data-model migration (rename/collapse `itinerary_days` + `plans` into a flatter shape, or keep the table but hard-code `day_number = 1` everywhere and strip the *concept* from the UI/schema without touching the DB yet). Two migration strategies exist with different risk/effort — pick one before writing tasks:

- **A (low-risk, ship first):** Keep `itinerary_days` in the DB exactly as-is (avoids a migration + RLS rewrite), but every code path always creates exactly one day row and the Zod schema/UI stop exposing "day" as a user concept — `ItineraryPlanSchema` drops `days: array`, becomes flat `morning/afternoon/evening` at the plan level, and `convertAgentPlanToDayPlans`/`itinerary-service` always write `day_number: 1`. Multi-day fields (`packingTips` framed as trip-level, `totalEstimatedCost`) get renamed to reflect "tonight" framing. No migration, no RLS change, smaller diff.
- **B (full collapse):** New migration that flattens `itinerary_days` + `plans` into a single `plan_items` table hanging directly off `itineraries`, drops the day concept from the DB entirely. Bigger diff, touches RLS, requires a data-migration step for any existing rows, and is not reversible without a down-migration.

**Recommendation:** Strategy A. It gets 90% of the simplification (the schema, the UI, the mental model all stop talking about "days") without a risky RLS/migration rewrite, and can convert to B later if the DB shape itself becomes a real cost.

**This plan stops here.** Before writing Slice 3 tasks: confirm strategy (A vs B) with the user, and confirm whether any current production itinerary rows have `day_number > 1` (if the product has been single-night-only since the 016 pivot, this should be zero — check with a read-only query before deciding anything is safe to assume).

---

## Verification (all slices)

- `npx vitest run` — full suite must stay green
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- DOX pass: update `src/types` area (no AGENTS.md exists there yet — root AGENTS.md already lists `src/types` as directly owned, no child doc needed unless this grows), `src/lib/ai/AGENTS.md`, `src/lib/preferences` (no AGENTS.md currently — root-owned).

## Risks / open questions

- Slice 1/2: confirmed no DB migration needed (fields are TS-only). Still worth a final grep pass after each slice for anything the earlier search missed (env-driven feature flags, admin scripts, etc.).
- Slice 3: real schema risk. Needs the day_number>1 production check and a strategy decision (A vs B) before any code is touched.
- "Pie" as a possible 4th data source was explicitly deferred by the user (not in scope here).
- TikTok source stub: user flagged as "priority #4" — deferred, not touched in this plan.
