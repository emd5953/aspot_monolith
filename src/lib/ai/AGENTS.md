# AGENTS.md — `src/lib/ai`

## Purpose

The generation engine. Turns a prompt + profile into a saved, day-by-day itinerary. The same pipeline runs Fast ("Plan it") and Deep ("Send it") modes, and full-trip or single-day regeneration.

## Ownership

- `itinerary-generator.ts` — pipeline entry + DB persistence. `generateItinerary`, `regenerateItinerary`, `convertAgentPlanToDayPlans`, plus CRUD (`getItinerary`, `listItineraries`, `updateItineraryStatus`, `deleteItinerary`). Chooses between the classic and agentic orchestrators.
- `tavily-service.ts` — web research (`fetchDestinationData`): parallel attraction/restaurant/activity searches.
- `research-cache.ts` — disk cache keyed by `destination + intent` (~1 week) so repeat prompts don't re-pay network cost.
- `events-search.ts` — date-aware event lookup.
- `parse-prompt.ts` — prompt → structured intent.
- `provenance.ts` — `ItemSource` tracking so picks can be justified, not just listed.
- `estimate-cost.ts` — per-activity cost estimates.
- `schedule-times.ts` — `assignDayTimes`, real clock times for a day's activities.
- `schemas/plan.ts` — the Zod contracts (`ItineraryPlanSchema`, `DayPlanSchema`, `ScheduledItemSchema`, `SingleDaySchema`). The schema is the contract between every pipeline step.

## Local Contracts

- Pipeline order (per README): Understand → Discover → Rank → Plan → Critique → Persist. Each step has one job and a typed hand-off to the next.
- The system never invents places — candidates come from real research with provenance. Do not add code paths that fabricate venues.
- Orchestration lives in `agents/`; this layer wires research/curation/persistence around it and converts agent plans into stored day plans.
- Curation against the user's profile happens via `@/lib/preferences/score-research` before planning.

## Work Guidance

- All LLM outputs go through Zod (`schemas/`); never regex-extract JSON from model text.
- New pipeline behavior ships with a co-located `*.test.ts` (this dir is heavily tested: generator, cost, schedule-times, events, provenance, convert-plan).

## Verification

- `npm test` (Vitest, single run) — co-located tests cover each module.

## Child DOX Index

- [`agents/`](agents/AGENTS.md) — specialized agents (researcher/planner/reviewer) and the two orchestration strategies (classic fixed-loop + agentic dynamic).
