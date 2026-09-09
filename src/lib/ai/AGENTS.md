# AGENTS.md — `src/lib/ai`

## Purpose

The generation engine. Turns a prompt + profile into a saved, day-by-day itinerary. The same pipeline runs Fast ("Plan it") and Deep ("Send it") modes, and full-trip or single-day regeneration.

## Ownership

- `itinerary-generator.ts` — pipeline entry + DB persistence. `generateItinerary`, `regenerateItinerary`, plus CRUD (`getItinerary`, `listItineraries`, `updateItineraryStatus`, `deleteItinerary`).
- `tavily-service.ts` — web research (`fetchDestinationData`): parallel attraction/restaurant/activity searches.
- `research-cache.ts` — disk cache keyed by `destination + intent` (~1 week) so repeat prompts don't re-pay network cost.
- `events-search.ts` — date-aware event lookup.
- `parse-prompt.ts` — prompt → structured intent.
- `provenance.ts` — `ItemSource` tracking so picks can be justified, not just listed.
- `estimate-cost.ts` — per-activity cost estimates.
- `pool-events.ts` — converts `candidate_events` pool rows (the Moves: Posh/Luma/Partiful) into `ActivityData`. Carries `startsAt`/`endsAt` through verbatim: that real published time is the product's ordering signal and must never be re-derived or invented.
- `schemas/plan.ts` — the Zod contracts. `MoveListSchema` / `SelectedPlanSchema` are the live pair; the day-shaped schemas below them are legacy and unused.

## Local Contracts

- **Spotz selects; it does not schedule.** One pass, in `agents/pipeline.ts`: curate by intent → select (one LLM call) → stamp real times + provenance → dedupe → order by `startsAt` → check. There are no days, no time buckets, and no invented clock times.
- **The model is never asked what time anything happens.** It picks and ranks; the pipeline stamps `startsAt` afterwards by matching each pick back to the pool. A model asked for a time always produces one, and a confabulated time is indistinguishable from a real one after the fact — so it is not asked. A pick that cannot be traced to the pool gets no time and `source: 'ai'`.
- Ordering is `startsAt` ascending, unknown last, ties stable (`agents/order-plans.ts`). It compares instants, not strings, and treats an unparseable date as unknown rather than as epoch 0.
- Spotz is NYC-only, single-day ("tonight"), no quiz. `parsePrompt` (`parse-prompt.ts`) always returns `destination: "New York City"`; it extracts date/neighborhood/vibe, not a place to travel to. Generation runs on `defaultPreferencesFor` (`@/types/profile`) — there is no per-user preference profile, and that type carries no quiz-shaped fields (motivations/cuisines/authenticity are gone; nothing could set them). Prompt intent, not a profile, is the taste signal — `userIntent` is what `score-research` and the Tavily queries actually steer on.
- Pool events are merged by `agents/research.ts` AFTER the research cache is read and BEFORE curation — never inside the researcher or the cache — so a cache hit can never serve last week's events as tonight's. That module also never caches an empty result, so one Tavily failure cannot poison the next hour.
- `saveItineraryToDatabase` archives the caller's previous draft/active itineraries before inserting the new one — Spotz keeps exactly one active itinerary per user; older ones become read-only history.
- The system never invents places — candidates come from real research with provenance. Do not add code paths that fabricate venues. (The model can still name places from recall; `agents/plan-check.ts` measures that as the off-pool ratio, and such picks get no time and `source: 'ai'`.)
- Google Places resolution (`@/lib/maps/place-verification`, gated by `PLACES_VERIFICATION_ENABLED`) **enriches, never filters**. Its job is stamping coordinates so the map can plot the night. Candidates it cannot resolve stay in the pool unlocated: the unresolvable ~10-25% is mostly dated events and walking tours that correctly have no Places entry, and dropping them deletes the events feature.
- Fast and Deep are one pipeline. They differ in pool width (`poolLimit`) and delivery — Fast streams to screen, Deep runs in the background and emails.
- Persistence writes ONE hidden `itinerary_days` row (`day_number: 1`) so a flat list satisfies `plans.day_id NOT NULL` without a migration. Nothing above persistence knows days exist; read `StoredItinerary.plans`, never `.days`.
- `plans.start_time` holds the real published time or NULL. Never write a fabricated slot.
- Curation against the user's profile happens via `@/lib/preferences/score-research` before planning.

## Work Guidance

- All LLM outputs go through Zod (`schemas/`); never regex-extract JSON from model text.
- New pipeline behavior ships with a co-located `*.test.ts` (this dir is heavily tested: pool-events, cost, provenance, estimate-cost).

## Verification

- `npm test` (Vitest, single run) — co-located tests cover each module.

## Child DOX Index

- [`agents/`](agents/AGENTS.md) — the single selection pipeline: research, select, order, check.
