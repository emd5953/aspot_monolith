# AGENTS.md — `src/components`

## Purpose

React UI. The aesthetic is the product: hand-drawn cards, taped post-its, human typography (Caveat + Inter). If it starts feeling like a SaaS dashboard, the product is broken.

## Ownership

- `ui/` — hand-drawn primitives (`hand-drawn-button`, `hand-drawn-card`, `hand-drawn-input`, `prompt-input`, `promo-chip`, `top-nav`). Compose from these; don't reinvent base controls.
- `itinerary/` — the plan surface: search pill, view, day schedule, map, timeline, edit/regenerate modals, activity cards, `vote-chips.tsx` (👍/👎 on a plan).
- `quiz/`, `trips/` — none. Spotz has no onboarding quiz and no trip/collab dashboard; sharing + voting live in `itinerary/`.
- `landing/`, `layout/`, `profile/`, `auth/`, `dashboard/` — supporting surfaces.

## Local Contracts

- Build on `ui/` primitives and Tailwind tokens; keep the hand-drawn look consistent across new surfaces.
- Components render and call API routes (`@/app/api/...`); they do not embed generation/persistence logic — that lives in `@/lib`.
- The home prompt is a single sentence in ("say the word, get the moves"); don't turn creation flows into multi-step forms or a chatbot. Conversation is for *refining* an existing plan.
- Spotz voice: NYC-native, playful, zero corporate. Copy reads like a friend who knows where it's at ("Yurrrrr", "the moves", "no cap"), never like a SaaS product.

## Work Guidance

- Co-locate component tests where behavior matters (see `itinerary/activity-card.test.tsx`); React Testing Library + happy-dom.

## Verification

- `npm test` (Vitest), `npm run lint`.
