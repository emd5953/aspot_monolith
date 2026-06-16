# aSpot Autonomous Build Backlog

The autonomous build loop works through this list top to bottom. It picks the
first unchecked `[ ]` task, implements it on a feature branch, runs lint + tests
+ typecheck + build, commits, then checks it off here. Edit freely — reorder,
add, or remove tasks. One task = one self-contained, shippable unit of work.

The recurring end-to-end audit lives LAST on purpose: it never gets checked off,
so keeping it at the top would trap the loop and starve the feature work. With
it last, the loop ships the concrete features first, then settles into
perpetually auditing the app (filing + fixing breaks) once they're done.

## Tasks

- [ ] Generation: fix the getItinerary activity type-lie. getItinerary returns
      flat activity objects but types day.activities as ActivityRecommendation[],
      forcing `as unknown as` casts at call sites (e.g. the calendar route).
      Introduce a proper StoredActivity / StoredDay type for what getItinerary
      actually returns and thread it through, removing the casts. Type-only +
      tests still green; no behavior change.

- [ ] Generation: single-day regen should keep times (+ coords). regenerateDay
      (day-regeneration-service.ts) inserts replacement activities without
      start_time/end_time, so regenerating a day strips its schedule. Run
      assignDayTimes over the new activities (and carry coords when available)
      so a regenerated day stays timed like the main path. Unit-test the mapping.

- [ ] "Tidy this day" — reorder a day's stops by proximity. Build on geo.ts +
      the now-persisted activity coords: a pure nearest-neighbor ordering that,
      starting from the first stop, visits the closest un-visited located stop
      next (stops without coords keep their relative order at the end). Add a
      "Tidy route" action on the day view that reorders via the existing
      activities/reorder endpoint, and only offer it when the day has >=3
      located stops and is currently flagged "spread out". Pure orderer
      unit-tested with known coordinates (shorter total path than the input);
      no paid API.

- [ ] End-to-end "does the whole app actually work" audit. Boot the app and walk
      the real user journey: home → prompt → onboarding quiz → itinerary
      generate (fast mode) → view → drag/regenerate a day → trips/share. For
      each flow, confirm pages render, key API routes respond, and there are no
      runtime/console errors. File every break you find as a new `- [ ]` task
      below with a one-line repro, then fix the highest-severity break in THIS
      cycle. (This task stays in the backlog — re-run it whenever the app
      changes; only the specific bug-fix tasks it spawns get checked off.)

## Done

- [x] Generation: per-activity cost estimates. New pure `estimate-cost.ts` maps
      price tier ($/$$/$$$/words) + category → ballpark USD; wired into
      activityToSimple so the cost rollup + budget-fit finally have data (7
      tests). — `8e54c8c`
- [x] Generation: restore activity schedule times. The planner's per-item "HH:MM"
      schedule was dropped (convertAgentPlanToDayPlans + activityToSimple), so
      every itinerary had timeless activities. New pure `schedule-times.ts`
      (assignDayTimes: honor planner times, bump overlaps, fill gaps from 09:00,
      8 tests) wired into both build paths and persisted to start_time/end_time;
      2 integration tests prove the planner schedule survives. Calendar export
      now emits real timed events. — `c70a06a`
- [x] Audit cycle 9 — new feature batch integrated clean (no fix). Broad smoke
      test after the 5-feature batch: home 200, dashboard/protected 307/401,
      new calendar route 401, autocomplete 200 live, no 500s / broken imports /
      log errors. The calendar/tips/cost/coords/rate-limit wiring all degrade
      gracefully when their migrations (013-015) aren't applied. Queued a
      proximity-reorder follow-up above.
- [x] Rate-limit itinerary generation: both generate routes enforce 10/rolling-
      hour per user before any paid call, returning 429 + Retry-After. Pure
      `checkRateLimit` (5 tests) + `checkGenerationRateLimit` over a new
      `generation_events` table (migration 015, RLS), failing open on storage
      errors so a missing migration never blocks users. — `8053234`
- [x] Per-day proximity sanity (haversine) + persist activity coords: generation
      now writes research coordinates to activities (activityToSimple →
      location_lat/lng via coordsColumns; getItinerary reads them back), and a
      pure `geo.ts` (haversine + isDaySpreadOut, 8 tests) drives a "covers a lot
      of ground" hint in the view. Only active when coords exist (Places
      verification). — `a86956d`
- [x] Per-day & trip cost rollup + budget fit: pure `cost.ts` (sum estimatedCost
      with decimal-string coercion, USD format, budget tier → ceiling →
      under/within/over, 9 tests). getItinerary exposes budgetRange from the
      snapshot; view shows trip total + budget-fit chip + per-day subtotal,
      gated on hasData. — `42e7eae`
- [x] Surface packing tips + important notes: planner-generated
      `packingTips`/`importantNotes` (previously dropped) now persisted
      (migration 014, best-effort UPDATE after the itinerary insert so a missing
      column never breaks generation), read back in getItinerary, rendered as a
      "Before you go" card in the view, and an escaped section in the email
      (threaded through both senders). 2 email tests. — `80200b7`
- [x] Calendar export (.ics): "Add to calendar" on the itinerary view downloads
      an RFC-5545 iCalendar (timed VEVENT when start+end present, else all-day).
      Pure builder `src/lib/calendar/ics.ts` (escaping/folding/UTC dates, 10
      tests) + owner-checked `GET /api/itinerary/[id]/calendar` returning
      text/calendar. No paid APIs. — `33199d3`
- [x] Audit cycle 8 — internals clean (no fix). Audited the Google Maps service
      and the agentic planner: the maps wrappers are correct (live-verified
      `getPlaceAutocomplete`), and the planner uses generateObject+Zod (no
      fragile parsing). No break found. Observation (left for human judgment,
      NOT auto-deleted): `getPlaceDetails`/`geocodeAddress`/`getDistanceMatrix`
      in google-maps-service.ts are currently unused — likely roadmap stubs for
      geocoding/travel-time; wire up or remove later.
- [x] Remove dead `smart-scheduler.ts`: 277-line module with zero importers
      (pipeline schedules via time-of-day buckets instead). Deleted after
      confirming no references; gate stays green. — `0cff324`
- [x] Audit cycle 7 → HTML injection in itinerary emails: title/destination/
      dates/activity names + view URL were interpolated into the email HTML
      unescaped, so user/AI content with `<`/`&`/`"` broke the layout or
      injected markup. Fixed with `escapeHtml` on every dynamic value in
      `buildItineraryEmailHtml`. 6 unit tests. (Also found: `smart-scheduler.ts`
      is dead code — filed above.) — `dda6ebd`
- [x] Atomic-safe day regeneration: `regenerateDay` now inserts replacement
      activities before deleting the originals (`swapDayActivities`), so a
      failed insert no longer wipes the day. `revertToVersion` left as-is — it
      already auto-snapshots before reverting, so failures are recoverable. 3
      unit tests. — `10100be`
- [x] Audit cycle 5 → missing ownership checks on revert/regenerate/versions:
      these routes relied on RLS alone, letting a trip member trigger owner-only
      ops (destructive revert, paid regenerate) on another user's itinerary, and
      breaking the codebase's owner-only pattern. Fixed with a shared pure
      `ownerGuard` (404/403/ok) applied after getItinerary in all three. 3 unit
      tests. (email route was already safe.) — `21ae675`
- [x] Audit cycle 4 → activity coords mapped to a nonexistent column:
      itinerary-service wrote/read `location_coords`, but the schema has
      `location_lat`/`location_lng`. Add/edit-activity with coords would 500 and
      every read silently dropped coords. Fixed with a shared `coordsColumns`
      helper (write) + `mapActivityFromDb` reading lat/lng with decimal-string
      coercion (read). 5 unit tests. — `d0b8d7c`
- [x] Audit cycle 3 → silent empty-itinerary on missing `source` column: the
      provenance insert (9a9a5e2) included `activities.source`; without
      migration 013 applied, Postgres rejected each row and the save loop only
      logged → itineraries saved with zero activities. Fixed via
      `insertActivityRow`, which retries the insert without `source` on error so
      activities always persist (badge waits for the migration). Both insert
      sites use the shared helper; 4 unit tests. — `0d93904`
- [x] Date-aware events: research layer runs a gated Tavily events pass for
      upcoming trips within a 180-day horizon (festivals/concerts/exhibitions),
      merged into the activity pool (category `event`, date in the name) so the
      planner can slot date-specific events. Pure `events-search.ts`
      (shouldSearchEvents + buildEventsQuery + formatDateWindow, 11 tests); trip
      dates threaded ResearchRequest → researchers → tavily-service; no spend
      when gated off. Live fetch/extraction not exercised (paid+authed). — `16f03d4`
- [x] AI-driven orchestrator decisions: `decideNextAction` in
      agentic-orchestrator.ts is now an LLM call (generateObject + Zod) that
      reasons over score + issues → continue/stop/research_more/revise.
      Deterministic hard guards (threshold / iteration ceiling) run first to
      bound cost; the original heuristic is kept as `decideNextActionRuleBased`
      and used as fallback on any model error. Decider is injectable; 8 tests
      cover guards/primary/fallback without a paid call. — `2b836be`
- [x] Provenance through the pipeline: each pick carries its `source`
      (`reddit`/`places`/`tavily`/`ai`) + the "why" (matchReasons → notes),
      surfaced as a badge in the itinerary view. New pure `provenance.ts`
      (deriveSource + name→source index, 10 tests); `ScheduledItem.source` in
      types + Zod; threaded through both generation paths; persisted via
      `activities.source` (migration 013) and read back; `ActivityCard` badge
      with 4 render tests. Live authed generation→DB round-trip not exercised
      (needs migration 013 applied; paid+authed path). — `9a9a5e2`
- [x] Audit cycle 2 → auth-callback 404 dead-end: a failed code exchange
      (expired/invalid email link or failed Google OAuth) redirected to
      `/login`, which doesn't exist (auth lives in the landing popover) → hard
      404. Fixed by redirecting failures to `/?authError=1` and surfacing a
      retry banner on the landing page. Verified live: callback (no code / bad
      code) both 307 → `/?authError=1` → 200 (was 404). 4 route tests. — `d4c15cc`
- [x] Reddit-targeted research: Reddit-biased Tavily query pass merged into the
      candidate pool, candidates tagged with a `redditMentions` provenance
      count, query builder + mention-counter unit-tested. — `9a604db`
- [x] Audit cycle 1 → auth hole: `(protected)` routes (itinerary, trips,
      profile/edit, [id] pages) rendered while signed out. Fixed by enforcing
      the session check once in `(protected)/layout.tsx`; verified live (all
      307 → / when unauthenticated). — `da4aaf7`
- [x] Google Places verification: candidates confirmed against Google "Find
      Place From Text" before reaching the planner; unresolvable/mismatched
      places dropped, survivors enriched with real address + coords. Gated by
      `PLACES_VERIFICATION_ENABLED` (default off). 14 tests. — `087d1f2`
