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
- **Theme judgement belongs to the model; theme structure belongs to code** (`theme.ts`). Whether a venue serves "house music" is world knowledge — a text matcher can only see that House of Yes and the Louis Armstrong House Museum both contain "house". `extractStructured` in `tavily-service` tags every candidate with `themeFit` (`direct` / `adjacent` / `none`) while it has the source page in front of it; everything downstream is deterministic on that tag. Do NOT reintroduce matching here. It was tried — stemming, category rules, nightlife marker lists — and each patch bought one case and broke another (`shop` matching `shopping`, `views` missing `viewpoint`, `bookstores` stemming to `bookstor`), while finding anchors for nightlife themes and zero for museums, vintage shopping, ramen, coffee or bookshops across five real pools.
- `theme.ts` keeps only what is structural: the *rhythm* a theme implies (a late theme overrides the quiz `timeRhythm` — profile is the floor, prompt is the steering wheel) and its *anchor slot*. `LATE_THEME_MARKERS` survives because it reads the user's own phrasing, never a candidate's description.
- **Anchors are `direct` only.** `adjacent` is worth having in the day and ranks up in curation, but it is not what the day is built around — a record bar is a good stop on a house music trip, not the reason anyone booked it. Every day needs an anchor **in its slot**; present-but-misplaced is a separate, lesser finding, because a night theme anchored on a bar at 10:00 is on-theme and useless.
- **An absent `themeFit` is unknown, never `none`.** The theme checks stay silent on an untagged pool (`poolWasThemeTagged`), the same way the geographic checks stay silent without coordinates. Reporting "nothing serves your theme" off a missing field is the same failure as calling a venue closed because its hours are unknown.
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
