# AGENTS.md — `src/components`

## Purpose

React UI. Minimal by design: each screen leads with its primary control, at
most one heading and one supporting line — the "Spotz voice" survives in that
one line, not in stacked copy. See `docs/specs/minimal-ui.md` for the full
rationale.

## Ownership

- `ui/` — flat primitives: `card.tsx` (`Card`), `button.tsx` (`Button`,
  variants `primary`/`ghost`/`quiet`), `input.tsx` (`Input`), `prompt-input.tsx`
  (`PromptInput`, `tone: 'paper' | 'cinematic'`), `mode-picker.tsx`
  (fast/deep segmented control), `overflow-menu.tsx`, `top-nav.tsx`,
  `surface.ts` (route → surface-mode helper). Compose from these; don't
  reinvent base controls or bring back wobble/shadow-stack styling.
- `itinerary/` — the plan surface: search pill, view, day schedule, map,
  timeline, edit/regenerate modals, activity cards, `vote-chips.tsx`
  (👍/👎 on a plan).
- `quiz/`, `trips/`, `dashboard/` — none. Spotz has no onboarding quiz, no
  trip/collab dashboard, and no dashboard-specific components (the
  `/dashboard` route lives in `src/app/(protected)/dashboard/page.tsx`
  directly); sharing + voting live in `itinerary/`.
- `landing/`, `layout/`, `profile/`, `auth/` — supporting surfaces.

## Local Contracts

- Two surface modes, chosen by route via `ui/surface.ts`, not threaded as a
  prop through every page: **cinematic** (`/`, `/dashboard`) keeps the video
  background, white text, one radial scrim, no text-shadow stacks or
  frosted-glass pills — legibility comes from the scrim alone. **Paper**
  (everything else under `(protected)`, plus `/s/[code]`) is flat
  `--surface-page`, dark ink, hairline borders, no video.
- One heading + one supporting line per screen, max. Captions that explain a
  control are deleted — the control explains itself.
- Components render and call API routes (`@/app/api/...`); they do not embed generation/persistence logic — that lives in `@/lib`.
- Optimistic updates must revert on `!res.ok`, not only in `.catch()`. `fetch` rejects only on network failure, so an expired session (`401`) or a `500` resolves normally and would otherwise leave the UI showing state that was never persisted.
- The home prompt is a single sentence in ("say the word, get the moves"); don't turn creation flows into multi-step forms or a chatbot. Conversation is for _refining_ an existing plan.
- Spotz voice: NYC-native, playful, zero corporate. Copy reads like a friend who knows where it's at ("Yurrrrr", "the moves", "no cap"), never like a SaaS product — but short; see Purpose.
- Any looping/decorative animation (`animate-fade-up`, `animate-pop-open`, etc. in `globals.css`) must be gated behind `prefers-reduced-motion` — the existing media-query block there freezes them to their end state.

## Work Guidance

- Co-locate component tests where behavior matters (see `itinerary/activity-card.test.tsx`); React Testing Library + happy-dom.

## Verification

- `npm test` (Vitest), `npm run lint`.
- `grep -rn "text-shadow" src/` and `grep -rn "hand-drawn\|PromoChip\|FloatingHint\|Kanye" src/` should return nothing (comments referencing the old names are fine).

