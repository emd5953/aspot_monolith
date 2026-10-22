# AGENTS.md — `src/lib/sources`

## Purpose

The NYC Moves supply chain. Connectors normalize source-published events into `candidate_events`; itinerary generation and conversational discovery read the pool, never scrape during a user request.

## Ownership

- `types.ts` — `EventSource`, `RawCandidateSchema`, `EventDetailsSchema`, NYC bounds. `normalize.ts` — timestamp/link normalization, explicit status and literal music/category evidence.
- `polite-fetch.ts` — shared sequential request gate, delay, timeout through body read, and typed HTTP failures with allowlisted Cloudflare challenge/Ray metadata. All connector traffic uses it. Error diagnostics exclude response bodies, cookies, and credentials; challenges are not retried.
- `posh.ts` — BFF explore pagination and optional bounded page enrichment, with an explicit Spotz service User-Agent. `structured-event.ts` parses JSON-LD/data strings without executing scripts.
- `luma.ts` — NYC internal discovery, nested geo/ticket extraction, cursor/id dedupe.
- `partiful.ts` — discover SSR + bounded similar-event traversal, rotating build id.
- `tiktok.ts` — disabled unimplemented source; explicit enablement raises an error.
- `pool-service.ts` — source/id upsert, expiry, conservative cross-source identity, fresh night-window reads and recommendation eligibility.
- `index.ts` — priority Partiful > Posh > Luma > TikTok and source gates.
- `__fixtures__/` — reduced public event facts captured 2026-10-22; no private attendee/account metadata. Live payload fixtures and synthetic test cases must be distinguishable.
- `docs/specs/data-sourcing.md` — endpoint recipes, actual integration status, live audit evidence, access limitations, and TikTok direction.

## Local Contracts

- Connectors fetch/normalize only; the pool service owns DB writes. Every candidate keeps source identity, URL, original payload, and fetch time. Unknown facts remain unknown, never default prices, times, or availability.
- All current discovery endpoints are undocumented. Technical success does not establish reuse permission. Do not bypass access controls. Keep flags independently disableable and check the flag inside each connector.
- First-page outages/malformed envelopes and total hydration failure throw. Bad individual items are skipped. Partial fetch failures retain prior results and invoke `onWarning`; `/api/ingest` responds 207 with `partialSources` or `failedSources`.
- Dedupe ids across pages and again before upsert; duplicate conflict keys can reject an entire Postgres batch. Bound requests/attempts and cursor traversal.
- Timestamps require an explicit offset. Invalid/ambiguous fields stay unknown; end-before-start is omitted with an issue. Preserve normalized published instants downstream.
- Read night boundaries through `@/lib/time/nyc`. `getTonightPool` applies observation freshness (24 hours), actual start/end/expiry, and cancellation/availability exclusions even if cron cleanup did not run. Undated stored events do not qualify as tonight's events. Published starts must fall inside the requested night window; a multi-week listing envelope does not establish an occurrence tonight. Ongoing events within that window also need a published end.
- Source absence is not cancellation. A failed refresh must never touch old `fetched_at`. Migration 021 atomically preserves cancelled/postponed and sold-out/closed states when an incoming summary supplies only unknown status; explicit source state can clear them. A zero-priced offer is not unconditional free entry. Waitlist configuration does not mean waitlisted admission.
- Obfuscated/guests-only locations retain public area text only; never recover hidden coordinates/addresses from an API payload. Unlocated events remain stored. Public place ids are namespaced; no geocoder guesses a venue from an event title.
- Cross-source dedupe requires shared identity/URL or full title + close time + compatible venue evidence. Preserve distinct same-source sessions, unknown venues, source links, and conflicts. Freshest observation wins, priority breaks ties; fresh cancellation/sellout evidence is retained.
- Literal music evidence means the listing mentions a genre, not that the venue is guaranteed to play it. This does not replace semantic theme assessment in the itinerary pipeline.
- Migration 021 is required before deploying `details` readers/writers. The RLS read/write boundary is unchanged.

## Work Guidance

- New connectors implement `EventSource`, join the registry, update the sourcing spec, and ship network-mocked fixtures.
- TikTok work must establish authorized access and corroborate event dates/locations; a scraping vendor or geocoded venue alone is insufficient.

## Verification

- `npm test -- src/lib/sources src/lib/discovery src/app/api/ingest` covers normalization, fixtures, identity, freshness, outages, and source-backed recommendation replay.

## Child DOX Index
