# Spotz Pivot — Technical Build Plan

> Branch: `spotz-pivot`. Local commits only — NO push, NO prod deploy, NO live Supabase migration application. Migrations are authored as files; applying them to prod is a founder decision.

**Goal:** Refactor aSpot → Spotz per the approved product doc (`2026-09-02-aspot-nyc-product.md`) and data sourcing doc (`2026-09-02-spotz-data-sourcing.md`).

**Architecture:** Keep the six-step pipeline and Fast/Deep modes. Replace Tavily-driven multi-day trip generation with a pool-backed single-itinerary "moves for tonight" generator reading from `candidate_events` (populated by scheduled source connectors: Posh, Luma, Partiful, TikTok). Strip trips/collab/quiz. Add lightweight share+vote.

**Naming decisions (code level):**
- Product: **Spotz**. DB: `itineraries` stays (the Move-list), `activities` → `plans` is UI-language; at code level we rename user-facing copy but keep `activities` table renamed to `plans` in migration 016.
- New tables: `candidate_events`, `itinerary_shares`, `plan_votes`.

---

## Phase 1 — DB migrations (authored, not applied)

- `016_spotz_pivot.sql`:
  - Drop: `trips`, `trip_members`, `suggestions`, `votes`, `rsvps`, `notifications`, `notification_preferences`, `quiz_progress`, `user_preferences` (CASCADE, in dependency order).
  - Rename `activities` → `plans` (keep columns; `day_id` stays pointing at `itinerary_days` — single day per itinerary now, day 1 only).
  - `itineraries`: make `start_date`/`end_date` the single evening date; add `share_code TEXT UNIQUE`, `vibe_prompt TEXT`; enforce one active per user via partial unique index `(user_id) WHERE status='active'`.
- `017_candidate_events.sql`: pool table — id, source (posh|luma|partiful|tiktok|places), source_id, source_url, title, description, starts_at, ends_at, venue_name, address, lat, lng, price_min/max, is_free, hype (jsonb: guest_count etc.), tags text[], raw jsonb, fetched_at, expires_at; unique (source, source_id); indexes on starts_at + geo.
- `018_shares_votes.sql`: `itinerary_shares` (itinerary_id, share_code unique, created_at) folded into itineraries if simpler; `plan_votes` (plan_id, voter_id/voter_name, vote smallint ±1, unique per voter per plan); RLS: votes readable by anyone with the itinerary share, writable by authed users; realtime publication on `plan_votes`.

## Phase 2 — Strip dead code

Delete (lib): `src/lib/trips`, `src/lib/quiz`, `src/lib/preferences` (keep `normalize` shim only if generator imports it — refactor generator to a default profile instead), `src/data` quiz content.
Delete (api): `src/app/api/trips/**`, `src/app/api/quiz/**`.
Delete (pages): `(protected)/trips`, `(protected)/quiz`, `(protected)/profile/edit` (keep bare profile page), dashboard trip-list bits.
Delete (components): `components/trips`, `components/quiz`, quiz bits of `profile`.
Fix all imports; generator gets a `DEFAULT_PROFILE` constant replacing quiz preferences (prompt carries everything now).

## Phase 3 — Source connectors (`src/lib/sources/`)

- `types.ts`: `EventSource` interface + `RawCandidate` Zod schema.
- `posh.ts`: BFF explore endpoint, cursor pagination, NYC coords, post-filter by lat/lng bounding box.
- `luma.ts`: discover/get-paginated-events with NYC place id, cursor pagination.
- `partiful.ts`: /discover __NEXT_DATA__ trending NYC + similarEvents graph crawl (depth 2, cap ~100), buildId auto-refresh.
- `tiktok.ts`: interface stub + config for vendor (bake-off deferred; returns [] with TODO), so pipeline compiles with 4 sources.
- `pool-service.ts`: upsert candidates, dedupe (name+date+coords fuzzy), expire past events, `getTonightPool(neighborhood?)`.
- Politeness: shared fetch helper with delay + UA + per-source enable flags (env).
- Tests: fixture-based (recorded JSON shapes) per connector + dedupe tests.

## Phase 4 — Ingestion + generation rewire

- `src/app/api/ingest/route.ts`: cron-guarded (secret header) endpoint running all enabled sources → pool. `vercel.json` cron entry (every 4h) — authored, inert until deploy.
- Generator: new `generateMoves` path in `src/lib/ai` — Understand (prompt→vibe/neighborhood/time-window via existing parse-prompt, NYC-locked) → Discover (pool query + Places food spots) → Rank (LLM vs prompt + hype) → Plan (order into evening timeline w/ schedule-times) → Critique (existing reviewer, single-day) → Persist (one itinerary, day 1, plans). Deep mode keeps agentic orchestrator + email.
- Archive-on-new: creating a new itinerary sets previous active → archived.

## Phase 5 — Share + votes

- `POST /api/itinerary/[id]/share` → share_code; public read route `GET /api/shared/[code]`.
- `POST /api/plans/[planId]/vote` (auth required, joins voter to itinerary implicitly).
- Realtime: Supabase channel on plan_votes for live thumbs.

## Phase 6 — UI

- Branding: aSpot → Spotz everywhere; landing hero: "Yurrrrr, what's the word bro" / prompt placeholder "find the Moves for tonight".
- Dashboard → single active itinerary view + quiet `/history` page (archived list, view-only).
- Itinerary view: single-day timeline (no day tabs), vote chips (👍/👎 + counts) on each plan card, share button.
- Shared view `/s/[code]`: read-only + voting.
- Remove quiz/trips nav. Keep hand-drawn primitives everywhere.

## Phase 7 — Verify + DOX + commits

- `npm test`, `npm run lint`, `npm run build` green.
- DOX pass: root AGENTS.md (product, structure, verification), src/lib/ai, src/lib/itinerary, src/app/api, src/components; new `src/lib/sources/AGENTS.md`.
- Commit per phase on `spotz-pivot`. No push.

## Risks

- Connector endpoints are undocumented → fixture-based tests, live smoke test optional/flagged.
- Big deletion surface → build after each phase catches broken imports.
- `activities`→`plans` rename touches many files → do mechanically with grep audit, run tests.
