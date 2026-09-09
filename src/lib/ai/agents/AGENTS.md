# AGENTS.md — `src/lib/ai/agents`

## Purpose

The generation pipeline: turn a prompt into one flat, ordered Move-list of real
NYC places for tonight. Spotz **selects**; it does not schedule.

## Ownership

- `pipeline.ts` — the whole run: curate → select (one LLM call) → stamp times +
  provenance → dedupe → order → check. Replaced both orchestrators.
- `research.ts` — Discover. Cache read, then pool-event merge, then curation.
- `researcher.ts` / `agentic-researcher.ts` — Tavily research behind `research.ts`.
- `order-plans.ts` — `orderByStartTime`, `dropDuplicatePlans`. Pure, model-free.
- `plan-check.ts` — the mechanical floor: duplicate venues, invented places.
- `theme.ts` — the user's theme as structure.
- `types.ts` — the inter-step contract.

## Local Contracts

- **The model is never asked what time anything happens.** It picks and ranks;
  the pipeline stamps `startsAt` afterwards by matching each pick back to the
  pool. A model asked for a time will always produce one, and a confabulated
  time is indistinguishable from a real one after the fact — so it is not
  asked. A pick that cannot be traced to the pool gets no time and
  `source: 'ai'`, which is the truthful answer, not a bug.
- **Absent is unknown, never a default.** No `startsAt` means the source
  published none; such plans sort last. Never coerce to midnight, "evening", or
  the start of the window. Same rule as opening hours and coordinates.
- Ordering compares instants, not strings (offsets differ), and treats an
  unparseable date as unknown rather than epoch 0 — otherwise one malformed row
  pins itself to the top of the night.
- **Mechanical quality is decided in code, not by the model** (`plan-check.ts`).
  An LLM reviewer once scored 92/100 for a plan that booked one venue twice; a
  Set notices, a model does not. The duplicate check is *within-list* — the old
  day-based one only fired across two days and would be a silent no-op here.
- **Theme judgement belongs to the model; theme structure belongs to code**
  (`theme.ts`). Whether a venue serves "house music" is world knowledge — a text
  matcher only sees that House of Yes and the Louis Armstrong House Museum both
  contain "house". `extractStructured` in `tavily-service` tags candidates with
  `themeFit` while the source page is in front of it. Do NOT reintroduce
  matching here: it was tried — stemming, category rules, nightlife marker lists
  — and each patch bought one case and broke another (`shop` matching
  `shopping`, `views` missing `viewpoint`), finding anchors for nightlife themes
  and zero for museums, ramen, coffee or bookshops across five real pools.
- **An absent `themeFit` is unknown, never `none`.** Reporting "nothing serves
  your theme" off a missing field is the same failure as calling a venue closed
  because its hours are unknown.
- Merge pool events AFTER the research cache read (`research.ts`) — a cache hit
  would otherwise serve last week's events as tonight's — and never cache an
  empty research result, or one Tavily failure poisons the next hour.
- Name comparison anywhere in this directory goes through `dedupeKey`
  (`../provenance.ts`). Ad-hoc `name.toLowerCase().trim()` is how
  "The Bluebird Cafe" and "Bluebird Cafe" shipped as two different places.
- Fast and Deep are the same pipeline: they differ in pool width (`poolLimit`)
  and delivery, not in logic.

## Work Guidance

- LLM output goes through Zod (`../schemas/plan.ts`), never regex-extracted.
- Value constraints belong in the `normalize*` helpers, not the wire schema:
  we send `strictJsonSchema: false`, so every schema constraint is a client-side
  throw waiting to happen.
- A single malformed model response must never abort a generation.

## Verification

- `npm test` — `pipeline.test.ts`, `plan-check.test.ts`, `order-plans.test.ts`,
  `theme.test.ts`.
- `pipeline.test.ts` mocks the model seam and asserts on everything around it:
  that real times are stamped from the pool, that an invented place gets none,
  and that the list is ordered by when events actually start. Sabotaging the
  stamping or the ordering must turn it red — check that it still does before
  trusting a green run.
