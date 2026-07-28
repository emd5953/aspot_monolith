# AGENTS.md — `src/lib/ai/agents`

## Purpose

Specialized AI agents and the orchestration strategies that coordinate them. This is the multi-agent core of the generation pipeline: research → plan → review.

## Ownership

- Agent role implementations: `researcher.ts`, `planner.ts`, `reviewer.ts`
- "Agentic" variants with dynamic reasoning: `agentic-researcher.ts`, `agentic-planner.ts`
- Orchestrators that drive the loop: `orchestrator.ts`, `agentic-orchestrator.ts`
- Per-day pool slicing and model-free day assembly: `pool-partition.ts`
- Deterministic quality gate: `plan-audit.ts`
- Deterministic quality *fixes*: `plan-repair.ts`
- The user's theme as structure: `theme.ts`
- The inter-agent contract: `types.ts`

## Local Contracts

- `types.ts` is the binding contract between agents (`AgentRole`, `AgentMessage`, `AgentState`, `ResearchRequest`, `ResearchResult`, `ItineraryPlan`, `ScheduledItem`). Changing a shape here ripples through every agent and the parent generator — update all consumers in the same pass.
- Two orchestration strategies, both consumed by `../itinerary-generator.ts`:
  - `runOrchestrator` (`orchestrator.ts`) — classic, fixed loop (`MAX_ITERATIONS = 3`), research → plan → review → re-plan until approved or capped.
  - `runAgenticOrchestrator` (`agentic-orchestrator.ts`) — dynamic: decides when to stop by quality threshold (default 60), may skip review, surfaces a reasoning chain. Default `maxIterations = 1` for speed.
- Both orchestrators read cached research via `../research-cache` and curate it through `@/lib/preferences/score-research` before planning.
- `userIntent` / original prompt are optional free-text inputs that bias research toward the user's theme; profile is the floor, prompt is the steering wheel.
- **Mechanical quality is decided in code, not by the model.** `auditPlan` (`plan-audit.ts`) computes duplicate venues, per-day geographic spread, out-of-region outliers, empty buckets, missing dinners, backwards clocks, and off-pool (invented) items. It returns a `scoreCeiling`, and the reviewer may not score above it. Left to itself the LLM reviewer scored 92/100 for a plan that booked one venue twice and 85/100 for a day that crossed Lisbon four times — and because the orchestrator stops the moment its threshold is met, those inflated scores meant deep mode's five iterations always ended after one. Add a new mechanical check here, not to the reviewer prompt.
- **The theme is structure, not prompt advice** (`theme.ts`). A stated intent decides two things in code: the day's *rhythm* (a late theme overrides the quiz `timeRhythm` — profile is the floor, prompt is the steering wheel) and the day's *anchor slot*. Every day must carry an on-theme item **in that slot**; present-but-misplaced is a finding, because a night-out theme anchored on a bar at 10:00 is on-theme and useless.
- **Theme matching is category-first, and must stay general.** A stemmed intent token matching a candidate's research `category` ("museum", "shopping", "nightlife") is strong evidence; the same word in prose is weak. That one rule is what makes the mechanism work for *any* prompt — before it, "house music" and "jazz bars" found 1-8 anchors per pool while "museums and galleries", "vintage shopping", "ramen", "coffee shops" and "bookstores" found ZERO, in pools containing the Frist Art Museum and The Cloisters. Category comparison is exact after stemming, never substring: "shop" is inside "shopping", and substring matching anchored a coffee theme on a taxidermy store. `ScheduledItem` has no category, so audit and repair both recover it from the research pool by `dedupeKey`.
- **`isOnTheme` needs both halves.** Phrase-first scoring alone rejects "Louis Armstrong House Museum" for a *house music* trip — correctly — and rejects "House of Yes" for the same reason, since the pool records it only as `category: nightlife`. So a late theme also accepts a late-venue *kind*. Keep `LATE_VENUE_MARKERS` to words that mean "a place you go at night": "live music", "party" and "dance" were in there and matched "Museum Mile Festival", which repair then moved to 21:00.
- **Fixed points are placed before fill, in priority order**: theme anchor → meals → generic fill. Fill ran first once and spent the day's only restaurant on a 14:00 slot, leaving the evening with nowhere to eat.
- **Detect in `plan-audit`, fix in `plan-repair`.** A finding whose fix is mechanical belongs in `repairPlan`, which runs between planning and review on every iteration. It matters because fast mode (`maxIterations = 1`, the default) stops before any decision reasoning happens: the audit ceiling can cap a flawed plan but nothing ever acts on it, and the reviewer's revision only fires on an unapproved review carrying a high-severity issue. Repair is pure, idempotent, and model-free — a backwards clock, an empty bucket, a duplicate venue, and a venue booked while it is shut all have known-correct answers, so none of them should cost a `gpt-4o` round-trip. Adding a check without adding its repair means shipping the defect.
- `repairPlan` takes the per-day `pools` that `runAgenticPlanner` returns, so replacements and refills come from the same geo-clustered slice the day was planned against. Don't recompute the partition at the call site.
- **Opening hours beat the name heuristic.** When a research item carries `openingHours` (Place Details, stamped in `tavily-service`), `plan-audit` judges the schedule against the published week and skips the nightlife word-match entirely. Absent hours mean *unknown*, never *closed* — no finding, no repair.
- Models are per-job and env-overridable in `agentic-planner.ts`: the per-day build (the call that writes what the user reads) gets the strong model at low temperature; the strategy call stays cheap and hot. Grading is not where the model budget belongs.
- Every plan that ships must pass through `removeCrossDayDuplicates` (`agentic-planner.ts`). That includes a revision adopted from the reviewer, which otherwise bypasses all planner post-processing.
- **`runReviewerAgent` never revises.** `agentic-orchestrator` is the single path that adopts a revision: it calls `reviseItineraryPlan` once, on the iteration it stops on, then dedupes it, re-stamps the calendar from the plan already in hand, and adopts it only if coverage holds (same day count, no meaningful item loss) and `auditPlan` rates it no worse. A reviewer that handed a revision back to its caller made all of that skippable, so it doesn't.

## Work Guidance

- Keep each agent single-job; the orchestrator owns control flow, agents own their step.
- LLM outputs must be schema-validated — produce shapes that conform to `../schemas/plan.ts`, never regex-extracted JSON.
- **A single malformed model response must never abort a generation.** Days build in parallel, so one rejected promise takes the whole trip down; `agentic-planner` catches per-day failures and falls back to `buildFallbackDay`. Value constraints belong in the `normalize*` helpers, not in the wire schema — see `../schemas/plan.ts`.
- Name comparison anywhere in this directory goes through `dedupeKey` (`../provenance.ts`). Ad-hoc `name.toLowerCase().trim()` is how "The Bluebird Cafe" and "Bluebird Cafe" shipped as two different places.

## Verification

- `npm test` (Vitest) — `agentic-orchestrator.test.ts`, `agentic-orchestrator-repair.test.ts`, `agentic-planner.test.ts`, `plan-audit.test.ts`, `plan-repair.test.ts`, `pool-partition.test.ts`, `theme.test.ts`, `reviewer.test.ts`.
- `agentic-orchestrator-repair.test.ts` drives the real orchestrator with every model seam mocked and asserts on the plan the reviewer is *handed*. That's what pins "repair runs before review on the fast path" — the claim the whole pass exists for.
