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

## Project: aSpot

aSpot turns one sentence into a real, day-by-day trip. Say what you want; it researches real places, builds the days, and hands back an itinerary that reflects the prompt — not a top-10 list, not a chatbot.

- **Stack:** Next.js (App Router) + React 19 + TypeScript; Supabase (Postgres, RLS, Realtime, OAuth); OpenAI via the Vercel AI SDK; Tavily for research; Google Maps/Places; Resend for Deep-mode email; deployed on Vercel.
- **The contract is the schema.** Zod types in `src/lib/ai/schemas` are the hand-off between every pipeline step. LLM outputs are schema-validated, never regex-extracted.
- **Core principle:** profile is the floor, prompt is the steering wheel. The system never invents places — candidates come from real research with provenance.
- **Two modes, one pipeline:** Fast ("Plan it", streams on screen) and Deep ("Send it", background work + email). Same six steps: Understand → Discover → Rank → Plan → Critique → Persist.
- **Migrations** live in `supabase/migrations/`. `src/types` holds shared TypeScript contracts; `src/data` holds static content (quiz questions); `src/test` holds fixtures/setup.

### Verification

- `npm test` (Vitest) · `npm run lint` (ESLint) · `npm run build` (type-check + build) · `npm run format`

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- [`src/lib/ai/`](src/lib/ai/AGENTS.md) — the generation engine: research, curation, persistence, schemas, cost/time. Contains child [`agents/`](src/lib/ai/agents/AGENTS.md).
- [`src/lib/itinerary/`](src/lib/itinerary/AGENTS.md) — persistence, versioning, ownership, and post-generation editing (reorder, swap, day-regenerate, revert, cost rollup).
- [`src/app/api/`](src/app/api/AGENTS.md) — App Router route handlers: authenticate, authorize, delegate to `lib`.
- [`src/components/`](src/components/AGENTS.md) — React UI and the hand-drawn aesthetic that is the product.

Owned directly by this root (no child doc yet — simple, single-purpose): `src/lib/preferences` (quiz→profile, curation/scoring), `src/lib/trips`, `src/lib/quiz`, `src/lib/maps`, `src/lib/calendar`, `src/lib/email`, `src/lib/ratelimit`, `src/lib/supabase` (client/server/middleware), `src/app/(protected)`, `src/types`, `src/data`, `src/test`.