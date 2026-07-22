# AGENTS.md — `src/lib/ai/agents`

## Purpose

Specialized AI agents and the orchestration strategies that coordinate them. This is the multi-agent core of the generation pipeline: research → plan → review.

## Ownership

- Agent role implementations: `researcher.ts`, `planner.ts`, `reviewer.ts`
- "Agentic" variants with dynamic reasoning: `agentic-researcher.ts`, `agentic-planner.ts`
- Orchestrators that drive the loop: `orchestrator.ts`, `agentic-orchestrator.ts`
- Per-day pool slicing and model-free day assembly: `pool-partition.ts`
- Deterministic quality gate: `plan-audit.ts`
- The inter-agent contract: `types.ts`

## Local Contracts

- `types.ts` is the binding contract between agents (`AgentRole`, `AgentMessage`, `AgentState`, `ResearchRequest`, `ResearchResult`, `ItineraryPlan`, `ScheduledItem`). Changing a shape here ripples through every agent and the parent generator — update all consumers in the same pass.
- Two orchestration strategies, both consumed by `../itinerary-generator.ts`:
  - `runOrchestrator` (`orchestrator.ts`) — classic, fixed loop (`MAX_ITERATIONS = 3`), research → plan → review → re-plan until approved or capped.
  - `runAgenticOrchestrator` (`agentic-orchestrator.ts`) — dynamic: decides when to stop by quality threshold (default 60), may skip review, surfaces a reasoning chain. Default `maxIterations = 1` for speed.
- Both orchestrators read cached research via `../research-cache` and curate it through `@/lib/preferences/score-research` before planning.
- `userIntent` / original prompt are optional free-text inputs that bias research toward the user's theme; profile is the floor, prompt is the steering wheel.
- **Mechanical quality is decided in code, not by the model.** `auditPlan` (`plan-audit.ts`) computes duplicate venues, per-day geographic spread, out-of-region outliers, empty buckets, missing dinners, backwards clocks, and off-pool (invented) items. It returns a `scoreCeiling`, and the reviewer may not score above it. Left to itself the LLM reviewer scored 92/100 for a plan that booked one venue twice and 85/100 for a day that crossed Lisbon four times — and because the orchestrator stops the moment its threshold is met, those inflated scores meant deep mode's five iterations always ended after one. Add a new mechanical check here, not to the reviewer prompt.
- Every plan that ships must pass through `removeCrossDayDuplicates` (`agentic-planner.ts`). That includes a `revisedPlan` adopted from the reviewer, which otherwise bypasses all planner post-processing.
- Reviewer revisions are opt-in (`ReviewRequest.autoRevise`, default off). The orchestrator calls `reviseItineraryPlan` once, on the iteration it stops on, and adopts the result only when `auditPlan` says it is no worse than the plan already in hand.

## Work Guidance

- Keep each agent single-job; the orchestrator owns control flow, agents own their step.
- LLM outputs must be schema-validated — produce shapes that conform to `../schemas/plan.ts`, never regex-extracted JSON.
- **A single malformed model response must never abort a generation.** Days build in parallel, so one rejected promise takes the whole trip down; `agentic-planner` catches per-day failures and falls back to `buildFallbackDay`. Value constraints belong in the `normalize*` helpers, not in the wire schema — see `../schemas/plan.ts`.
- Name comparison anywhere in this directory goes through `dedupeKey` (`../provenance.ts`). Ad-hoc `name.toLowerCase().trim()` is how "The Bluebird Cafe" and "Bluebird Cafe" shipped as two different places.

## Verification

- `npm test` (Vitest) — `agentic-orchestrator.test.ts`, `agentic-planner.test.ts`, `plan-audit.test.ts`, `pool-partition.test.ts`.
