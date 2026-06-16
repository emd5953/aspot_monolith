# aSpot Autonomous Build Backlog

The autonomous build loop works through this list top to bottom. It picks the
first unchecked `[ ]` task, implements it on a feature branch, runs lint + tests
+ typecheck + build, commits, then checks it off here. Edit freely — reorder,
add, or remove tasks. One task = one self-contained, shippable unit of work.

## Tasks

- [ ] End-to-end "does the whole app actually work" audit. Boot the app and walk
      the real user journey: home → prompt → onboarding quiz → itinerary
      generate (fast mode) → view → drag/regenerate a day → trips/share. For
      each flow, confirm pages render, key API routes respond, and there are no
      runtime/console errors. File every break you find as a new `- [ ]` task
      below with a one-line repro, then fix the highest-severity break in THIS
      cycle. (This task stays in the backlog — re-run it whenever the app
      changes; only the specific bug-fix tasks it spawns get checked off.)
- [ ] Carry provenance through every pipeline step: extend the schemas so each
      ScheduledItem keeps its source (`tavily` / `reddit` / `places`) and the
      "why I picked this" reason, and surface it in the itinerary view.
- [ ] AI-driven orchestrator decisions: replace the rule-based
      `decideNextAction` in agentic-orchestrator.ts with an LLM call that
      reasons over current score + issues and returns
      continue/stop/research_more/revise. Keep the rule-based path as fallback.
- [ ] Date-aware events: when trip dates fall in a window, add an events search
      (Eventbrite/Resy/Ticketmaster style) and let the planner slot a
      date-specific event when it's the obvious right answer.

## Done

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
