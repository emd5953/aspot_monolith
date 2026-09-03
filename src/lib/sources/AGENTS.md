# AGENTS.md — `src/lib/sources`

## Purpose

The Moves supply chain. Source connectors pull live NYC events (parties, functions, popups, food-adjacent happenings) from external platforms into the `candidate_events` pool that generation reads from. Generation NEVER fetches sources live — the pool decouples freshness from request latency.

## Ownership

- `types.ts` — the binding contract: `EventSource` interface, `RawCandidateSchema` (Zod), `SourceName`, NYC bounding box + `isInNyc`.
- `polite-fetch.ts` — shared fetch helper: browser UA, process-wide minimum inter-request delay, timeout. All connector traffic goes through it.
- `posh.ts` — Posh BFF explore endpoint (`posh.vip/api/bff/v1/explore/events`), cursor pagination.
- `luma.ts` — Luma discover endpoint (`api.lu.ma/discover/get-paginated-events`), NYC place id, cursor pagination.
- `partiful.ts` — Partiful `/discover` `__NEXT_DATA__` trending NYC + `similarEvents` BFS (depth 2, capped); buildId re-extracted per run.
- `tiktok.ts` — stub, disabled by default; awaits commercial scraper vendor decision.
- `pool-service.ts` — pool persistence: `upsertCandidates` (geo-filter + upsert), `expireCandidates`, `getTonightPool` (windowed read + cross-source dedupe), `dedupeRows`/`normalizeDedupeKey`.
- `index.ts` — `ALL_SOURCES` in product priority order (Partiful > Posh > TikTok > Luma), `enabledSources()`.

## Local Contracts

- Connectors fetch and normalize ONLY — `pool-service` owns all DB access.
- Every candidate carries provenance: `source`, `sourceId`, `sourceUrl`, untouched `raw` payload, `fetched_at`. Spotz never invents events; a candidate that fails `RawCandidateSchema` is skipped, never repaired by guessing.
- All endpoints are UNDOCUMENTED third-party internals and can change or block at any time. Every connector: (a) parses defensively (log-and-continue, never throw on a single bad item), (b) is independently disableable via `SOURCE_<NAME>_ENABLED` env flag, (c) stays polite — sequential requests through `politeFetch`'s shared delay, bounded pagination.
- Unlocated candidates (no lat/lng) STAY in the pool (`isInNyc` returns true for undefined coords) — dated events without a Places entry are the product, same rule as the maps layer's "enrich, never filter".
- Cross-source dedupe (same party on Posh + Partiful) is deterministic: normalized title + date key, source-priority tiebreak. LLM ranking downstream must treat surviving rows as ground truth.
- Ingestion entry point is `src/app/api/ingest/route.ts` (cron-secret-gated, service-role client, sequential source loop). Schedule lives in `vercel.json`.

## Work Guidance

- New connector = implement `EventSource`, add to `ALL_SOURCES` in priority position, document the endpoint recipe in `.hermes/plans/2026-09-02-spotz-data-sourcing.md`, ship with fixture-based tests (mock `polite-fetch`; never hit the network in tests).
- When a connector's endpoint changes shape, fix the connector's flexible extraction first; only add new hard assumptions with fixtures proving them.

## Verification

- `npm test` (Vitest) — `posh.test.ts`, `luma.test.ts`, `partiful.test.ts`, `pool-service.test.ts`, all fixture-based.
