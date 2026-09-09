# Minimal UI pass

## Problem

Every Spotz screen leads with prose. The dashboard alone stacks a brand label,
a two-line serif headline, a subhead, an input, two mode pills, a caption, and a
floating hint card — seven text blocks before the user can do the one thing they
came for. Interior pages repeat the pattern on top of a video background, so
each one also carries a `[text-shadow:...]` stack and a `backdrop-blur` frosted
pill to stay legible. The result is high visual noise and slow time-to-action:
the user has to read past the app to use it.

## Goals / Non-goals

**Goals**
- Cut word count per screen to roughly a third; every screen leads with its
  primary control, not its copy.
- Interior pages (moves list, itinerary detail, profile) become flat, quiet,
  dark-on-light surfaces — no video, no text-shadow, no frosted glass.
- Landing and dashboard keep the video, but lose the layered scrims and shadow
  stacks that make text fight the footage.
- One visual system: a single card, a single button, a single input, shared
  spacing scale.

**Non-goals**
- No changes to routes, data model, API handlers, or generation pipeline.
- No new features. Deep research keeps working exactly as it does today.
- No copy *rewrite* beyond shortening — the "Yurrrrr / what's the word" voice
  stays, just less of it.
- No dark mode. No design-token renaming (`--ink`, `--accent` etc. stay).
- No redesign of the map, the day timeline internals, or vote chips beyond
  inheriting the new primitives.

## Approach

Two surface modes, decided by route, instead of one photographic mode applied
everywhere with escalating legibility hacks.

- **Cinematic** — `/` and `/dashboard`. Video background, white text, a single
  soft radial scrim. These are the two "arrival" screens where the atmosphere
  earns its keep and the content is one input.
- **Paper** — everything under `(protected)` except the dashboard. Flat
  `--surface-soft` background, dark ink, hairline borders, no shadows deeper
  than one step. These are the working screens where content density is real
  and video is pure interference.

The alternative considered was keeping video everywhere and dimming it harder.
It lost because the video isn't the actual cost — the *compensation* for it is.
Text shadows, three scrim layers, `bg-white/85` + `backdrop-blur-md` pills, and
white-on-photo copy are what make the interior pages feel loud. Dimming keeps
all of that machinery and just makes the app darker.

Copy shortening follows one rule: **each screen gets at most one heading and one
supporting line.** Captions that explain a control are deleted — the control
explains itself.

## Design

### Tokens (`src/app/globals.css`)

Add, alongside the existing set:

```css
--surface-page: #f7f8fa;   /* paper-mode page background */
--radius-card: 16px;       /* single card radius, replaces the 3 wobbly radii */
--shadow-card: 0 1px 2px rgba(11,30,60,0.04), 0 8px 24px -16px rgba(11,30,60,0.18);
```

Retire (delete the utilities, keep the CSS vars for one release): the
`--radius-wobbly*` trio, the hand-drawn rotation/border-radius wobble rules, and
the `body` cloud-gradient background (paper mode paints its own).

### Primitives (`src/components/ui/`)

Rename in place — same files, same exports where reasonable, so imports change
once:

| Current | Becomes | Change |
|---|---|---|
| `hand-drawn-card.tsx` | `card.tsx` → `Card` | Flat `--surface`, 1px `--border`, `--radius-card`, `--shadow-card`. Drops wobble rotation and the multi-layer shadow. |
| `hand-drawn-button.tsx` | `button.tsx` → `Button` | Three variants: `primary` (ink fill), `ghost` (text + hover tint), `quiet` (border only). Two sizes: `sm`, `md`. Drops the lift-on-hover translate. |
| `hand-drawn-input.tsx` | `input.tsx` → `Input` | Flat, 1px border, focus = accent ring. |
| `prompt-input.tsx` | `prompt-input.tsx` → `PromptInput` | Gains `tone: 'paper' \| 'cinematic'`; absorbs the `LightPill` variant currently duplicated inside `itinerary-search.tsx`. |
| `promo-chip.tsx` | — | Deleted. Its uses become plain small-caps labels or nothing. |

`ModePicker` moves out of `itinerary-search.tsx` into
`src/components/ui/mode-picker.tsx`, unchanged in behavior, restyled to a
segmented control (two labels sharing one border, active segment filled). The
caption under it is deleted.

### Per-screen layout

**`/` (landing, cinematic)** — `landing-hero.tsx`
- Delete: eyebrow "Your pocket moves plug", the "No credit card. Just the word.
  / Start free" footer line.
- Keep: headline `Yurrrrr, / what's the word?`, one subhead cut to
  `Parties, popups, food. Tonight.`, the prompt, Log in / Sign up.
- The sliding white auth pill stays — it's motion, not words.
- Scrim: keep the one radial gradient in `page.tsx`; delete the per-element
  `TEXT_SHADOW_HERO` / `TEXT_SHADOW_BODY` constants and every use of them.
  Legibility comes from the scrim alone.

**`/dashboard` (cinematic)** — `dashboard/page.tsx`
- Delete: the `Spotz` brand label (the nav already says it), the subhead
  `Say the vibe and Spotz finds the moves for tonight.`, and the entire
  `FloatingHint` mount.
- Keep: `Yurrrrr, {firstName}. / What's the word?` (headline), the input, the
  mode picker.
- `floating-hint.tsx` and `dashboard/` are deleted. History is reachable from
  the nav's "Moves" tab, which is where a user looks for it.

**`/itinerary` (paper)** — moves list
- Delete: `PromoChip`, the subhead
  `One live plan at a time — the old ones keep quietly below.`, the
  `View only` annotation next to "Old moves".
- Heading becomes a plain `Moves` label, not a 7xl serif hero — this is a list
  screen, the content is the plan card.
- Active plan card: title, destination, dates, one chevron. The `Open the plan`
  text row goes; the whole card is already the link.
- Empty state: one line + one button, no card wrapper.
- Loading: a skeleton card, not a spinner with `Fetching the move`.

**`/itinerary/[id]` (paper)** — detail
- `KanyeQuotes` removed from the regenerating state; a labelled progress line
  replaces it.
- Section headings `Packing tips` / `Good to know` become small-caps labels.
- The header block keeps title + destination + dates; action buttons collapse
  into one `⋯` menu (regenerate, share, delete) rather than a row.

**`/profile` (paper)**
- Delete: `Your Spotz card` label and the italic
  `No forms, no quizzes…` line.
- Result: avatar, name, `@username`, log out. Four elements.

**Nav** — `app-nav.tsx`, `top-nav.tsx`, `bottom-tabs.tsx`
- Top nav loses `tone` branching: it renders transparent-over-video on
  cinematic routes and hairline-bordered on paper routes, driven by a
  `usePathname` check in `app-nav.tsx` (one place, not a prop threaded through
  every page).
- Bottom tabs: icons only below `md`, labels dropped. Three destinations with
  distinct glyphs don't need words.

### Files

Created: `src/components/ui/card.tsx`, `button.tsx`, `input.tsx`,
`mode-picker.tsx`, `src/components/ui/surface.ts` (the route→mode helper).

Deleted: `hand-drawn-card.tsx`, `hand-drawn-button.tsx`,
`hand-drawn-input.tsx`, `promo-chip.tsx`,
`src/components/dashboard/floating-hint.tsx`,
`src/components/itinerary/kanye-quote.tsx`, `kanye-quotes.tsx`.

Changed: the five page files, `landing-hero.tsx`, `itinerary-search.tsx`,
`itinerary-view.tsx`, `timeline-view.tsx`, `activity-card.tsx`,
`day-schedule.tsx`, `edit-day-modal.tsx`, `regenerate-modal.tsx`,
`vote-chips.tsx`, `app-nav.tsx`, `top-nav.tsx`, `bottom-tabs.tsx`,
`globals.css`.

No dependencies added.

## Behavior

**Paper-mode page load.** Route under `(protected)` that isn't `/dashboard`:
the layout skips mounting `CoverVideo` and both scrims, paints
`--surface-page`, and renders content in dark ink. No layout shift on video
load, because there is no video.

**Cinematic-mode page load.** `/` and `/dashboard` mount `CoverVideo` as today.
The poster image covers the pre-play frame; the single radial scrim is CSS, so
text is legible on frame zero. If the video fails or `prefers-reduced-motion` is
set, the poster stands in — unchanged from current behavior.

**Submitting a prompt.** Identical to today: `fast` routes to the new itinerary,
`deep` shows the confirmation toast. The only change is that the in-flight state
loses `Building your trip` + `Researching spots and pacing your days.` +
`KanyeQuote`, and becomes a spinner plus one line: `Finding moves…`.

**Mode picker.** Segmented control, `fast` selected by default. Switching modes
changes only the submit button label (`Plan it` / `Send it`). The explanatory
caption is gone; the button label carries the difference.

**Empty history.** `/itinerary` with no plans shows one line and a `Plan
tonight` button that routes to `/dashboard`. No card, no illustration.

**Error states.** Unchanged in logic. Visually they become a single red-tinted
line under the control that failed, in both modes — no toast card, no shadow.

**Reduced motion.** All `animate-fade-up` / `animate-pop-open` /
`animate-gentle-bounce` usages get gated behind the existing
`prefers-reduced-motion` media query in `globals.css`. Today several run
unconditionally.

## Verification

- `npm run lint` and `npx tsc --noEmit` clean.
- `npx vitest run` — the four existing test files
  (`activity-card`, `day-schedule`, `itinerary-view`, `vote-chips`,
  `bottom-tabs`) must pass. `bottom-tabs.test.tsx` asserts on tab *labels*;
  it gets updated to assert on `aria-label` instead, since labels are dropped.
- `grep -rn "text-shadow" src/` returns nothing.
- `grep -rn "hand-drawn\|PromoChip\|FloatingHint\|Kanye" src/` returns nothing.
- Manual, at 375px and 1440px: landing → sign in → dashboard → submit a fast
  prompt → itinerary detail → back to moves → profile. Check no horizontal
  scroll, no white-on-white text, tab bar clears the safe area.
- Word count per screen: dashboard ≤ 12 words of chrome, profile ≤ 6, moves
  list ≤ 10.

## Risks / open questions

- **The video may be doing more work than it looks like.** If landing conversion
  depends on it, restricting it to two routes is still safe — those are the two
  routes an unauthenticated visitor sees.
- **Deleting Kanye quotes removes the only thing that made a 30-second wait
  tolerable.** Assumption: a shorter, honest progress line beats entertainment.
  If the wait feels worse after, the fix is a real progress indicator, not the
  quotes back.
- **`itinerary-view.tsx` is 380 lines and the densest surface.** It's the most
  likely place for the paper mode to look unfinished on the first pass; budget
  extra time in Milestone 3.
- Open: whether `/s/[code]` (shared read-only itinerary) is paper or cinematic.
  Assuming **paper**, since it's a content screen shown to someone who hasn't
  signed up — but it's also a first impression, so it may want the video.

## Milestones

1. **Tokens + primitives.** `globals.css` additions, new `card` / `button` /
   `input` / `mode-picker`, `surface.ts`. Old hand-drawn files re-export the new
   ones so nothing breaks mid-flight. Repo builds, app looks unchanged.
2. **Cinematic screens.** Landing + dashboard: copy cuts, shadow-stack removal,
   `FloatingHint` deleted, `itinerary-search` refactored onto `PromptInput` +
   `ModePicker`. Ship-able on its own.
3. **Paper screens.** Layout mode switch, moves list, itinerary detail, profile,
   shared `/s/[code]`. Delete `hand-drawn-*` and `promo-chip` re-export shims.
4. **Nav + cleanup.** Top nav route-driven tone, icon-only bottom tabs,
   reduced-motion gating, test updates, grep checks.
