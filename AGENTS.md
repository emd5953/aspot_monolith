# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## Project: Spotz

Spotz finds the Moves for tonight. Say the word — "date night in the Village, no cover", "we tryna dance in Bushwick" — and it hands back a curated, time-anchored run of real NYC events, functions, popups, and food spots. Share the link; the crew votes 👍/👎 on individual plans. One active itinerary at a time — no trip dashboard, no quiz, no travel-agent chatbot.

- **Stack:** Next.js (App Router) + React 19 + TypeScript; Supabase (Postgres, RLS, Realtime, OAuth); OpenAI via the Vercel AI SDK; Tavily for web research; Google Maps/Places; source connectors (Partiful/Posh/Luma + a TikTok stub) feed a `candidate_events` pool via a cron-gated `/api/ingest`; Resend for Deep-mode email; deployed on Vercel.
- **The contract is the schema.** Zod types in `src/lib/ai/schemas` are the hand-off between every pipeline step. LLM outputs are schema-validated, never regex-extracted.
- **Core principle:** the prompt is the floor AND the steering wheel — there is no quiz, no preference profile. The system never invents places or events; every candidate (web research or the Moves pool) carries provenance.
- **The servers run UTC; the product is Eastern.** Anything reasoning about "tonight" goes through `src/lib/time/nyc.ts` — never `Date.prototype.setHours`, which resolves in the server's zone and is therefore correct on an Eastern laptop and wrong in production.
- **Two modes, one pipeline:** Fast ("Plan it", streams on screen) and Deep ("Send it", background work + email). Same six steps: Understand → Discover → Rank → Plan → Critique → Persist.
- **Migrations** live in `supabase/migrations/`. `src/types/profile.ts` holds the neutral default `UserPreferences` the pipeline scores against (no quiz feeds it). `src/test` holds fixtures/setup.

### Verification

- `npm test` (Vitest) · `npm run lint` (ESLint) · `npm run build` (type-check + build) · `npm run format`

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- [`src/lib/ai/`](src/lib/ai/AGENTS.md) — the generation engine: research, curation, persistence, schemas, cost/time. Contains child [`agents/`](src/lib/ai/agents/AGENTS.md).
- [`src/lib/itinerary/`](src/lib/itinerary/AGENTS.md) — persistence, versioning, ownership, sharing/voting, and post-generation editing (reorder, swap, day-regenerate, revert, cost rollup).
- [`src/lib/sources/`](src/lib/sources/AGENTS.md) — the Moves supply chain: source connectors (Partiful/Posh/Luma/TikTok), the candidate pool, ingestion.
- [`src/app/api/`](src/app/api/AGENTS.md) — App Router route handlers: authenticate, authorize, delegate to `lib`.
- [`src/components/`](src/components/AGENTS.md) — React UI and the hand-drawn aesthetic that is the product.

Owned directly by this root (no child doc yet — simple, single-purpose): `src/lib/maps`, `src/lib/calendar`, `src/lib/email`, `src/lib/ratelimit`, `src/lib/time` (NYC-anchored night windows), `src/lib/supabase` (client/server/middleware, plus `service.ts` — the RLS-bypassing service-role client, server-only, for ingestion and share-link reads), `src/app/(protected)`, `src/types`, `src/test`.