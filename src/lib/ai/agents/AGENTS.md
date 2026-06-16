# AGENTS.md — `src/lib/ai/agents`

## Purpose

Specialized AI agents and the orchestration strategies that coordinate them. This is the multi-agent core of the generation pipeline: research → plan → review.

## Ownership

- Agent role implementations: `researcher.ts`, `planner.ts`, `reviewer.ts`
- "Agentic" variants with dynamic reasoning: `agentic-researcher.ts`, `agentic-planner.ts`
- Orchestrators that drive the loop: `orchestrator.ts`, `agentic-orchestrator.ts`
- The inter-agent contract: `types.ts`

## Local Contracts

- `types.ts` is the binding contract between agents (`AgentRole`, `AgentMessage`, `AgentState`, `ResearchRequest`, `ResearchResult`, `ItineraryPlan`, `ScheduledItem`). Changing a shape here ripples through every agent and the parent generator — update all consumers in the same pass.
- Two orchestration strategies, both consumed by `../itinerary-generator.ts`:
  - `runOrchestrator` (`orchestrator.ts`) — classic, fixed loop (`MAX_ITERATIONS = 3`), research → plan → review → re-plan until approved or capped.
  - `runAgenticOrchestrator` (`agentic-orchestrator.ts`) — dynamic: decides when to stop by quality threshold (default 60), may skip review, surfaces a reasoning chain. Default `maxIterations = 1` for speed.
- Both orchestrators read cached research via `../research-cache` and curate it through `@/lib/preferences/score-research` before planning.
- `userIntent` / original prompt are optional free-text inputs that bias research toward the user's theme; profile is the floor, prompt is the steering wheel.

## Work Guidance

- Keep each agent single-job; the orchestrator owns control flow, agents own their step.
- LLM outputs must be schema-validated — produce shapes that conform to `../schemas/plan.ts`, never regex-extracted JSON.

## Verification

- `npm test` (Vitest) — see `agentic-orchestrator.test.ts`.
