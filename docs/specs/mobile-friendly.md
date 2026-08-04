# Mobile-friendly pass

## Problem

aSpot is built desktop-first. On a 375px phone the app is not just cramped — parts of it
are unreachable:

- **Navigation is gone.** `TopNav` renders its links inside `hidden … md:flex` in both
  tones (`src/components/ui/top-nav.tsx:59`, `:102`). Below `md` an authenticated user can
  only reach `/dashboard` (the wordmark) and logout. `/itinerary`, `/trips` and `/profile`
  have no entry point at all.
- **Reordering is dead.** `DaySchedule` reorders via HTML5 `dragstart`/`drop`
  (`src/components/itinerary/day-schedule.tsx:59-84`), which touch browsers do not fire.
  The card still advertises `cursor-move`.
- **Editing a title is impossible.** The pencil is `opacity-0 group-hover:opacity-100`
  (`src/components/itinerary/itinerary-view.tsx:178`); there is no hover on touch.
- **Every text input zooms the viewport.** `HandDrawnInput` is `text-[15px]`
  (`src/components/ui/hand-drawn-input.tsx:32`); iOS Safari auto-zooms any input under 16px.

Beyond that: `100vh` sizing that jumps as browser chrome hides, `background-attachment:
fixed` (janky and often mis-rendered on iOS), no safe-area handling under the notch or home
indicator, a 480px-tall map that eats a whole phone screen, headings that start at
`text-6xl`, and desktop padding (`p-7`, `px-6`) applied at every width.

## Goals / Non-goals

**Goals**

- Every route usable and every action reachable at 375×667 (iPhone SE) through 430px.
- No horizontal scroll on any page at any width ≥320px.
- Interactive targets ≥44×44px; no action available only on hover.
- No viewport zoom on input focus; no layout jump from browser chrome.
- Content respects safe-area insets on notched devices.

**Non-goals**

- No redesign. Visual language, palette, copy and desktop layout stay as they are.
- No new pages, features, or route changes.
- No dark mode (the app is light-only today and stays that way).
- No tablet-specific layouts — `md`+ keeps its current behavior untouched.
- No PWA manifest, install prompt, or offline support.
- No touch drag-and-drop library.

## Approach

A responsive pass in place: mobile-first Tailwind on the existing components, plus two new
components where a behavior is genuinely missing on touch (bottom tab bar, reorder
buttons). Breakpoint set stays Tailwind's default; `md` (768px) is the existing
desktop/mobile line and every change below it is additive, so desktop renders identically.

The alternative considered was a separate mobile route group or a device-conditional
component tree. Rejected: it doubles the surface to maintain for an app whose layouts are
already fluid in most places — the actual failures are a short, specific list, not a
structural mismatch.

Two decisions taken on your behalf:

- **Baseline width is 375px**, verified down to 320px for no-overflow only.
- **`md` (768px) is the mobile/desktop boundary** everywhere, matching the existing
  `hidden md:flex` convention rather than introducing a new breakpoint.

## Design

### New files

| File | Owns |
| --- | --- |
| `src/components/layout/bottom-tabs.tsx` | Fixed bottom tab bar, below `md` only |
| `src/components/ui/reorder-buttons.tsx` | Move up / move down control pair |

```ts
// bottom-tabs.tsx
interface BottomTabsProps {
  tabs: { label: string; href: string; icon: LucideIcon }[];
}
export function BottomTabs(props: BottomTabsProps): JSX.Element;

// reorder-buttons.tsx
interface ReorderButtonsProps {
  onMoveUp?: () => void;   // undefined ⇒ first item, button disabled
  onMoveDown?: () => void; // undefined ⇒ last item, button disabled
  label: string;           // activity title, for the aria-labels
}
export function ReorderButtons(props: ReorderButtonsProps): JSX.Element;
```

`BottomTabs` uses `usePathname()` for the active state and renders
`md:hidden fixed bottom-0 inset-x-0 z-40` with `pb-[env(safe-area-inset-bottom)]`. It is
mounted once in `src/app/(protected)/layout.tsx` alongside `AppNav`, so it covers every
authenticated route and nothing on the public landing page.

### Changed files

**Global — `src/app/globals.css`, `src/app/layout.tsx`**

- `min-height: 100vh` → `100dvh` on `html, body`.
- `background-attachment: fixed` → `scroll` under `@media (max-width: 767px)`; the fixed
  parallax stays on desktop where it renders correctly.
- Export `viewport` from the root layout with `viewportFit: 'cover'` so
  `env(safe-area-inset-*)` reports real values.
- Add a `.tap-target` utility (`min-height: 44px; min-width: 44px`) for the handful of
  icon-only buttons that are visually smaller than the touch target they need.

**Navigation — `src/components/ui/top-nav.tsx`, `src/app/(protected)/layout.tsx`**

- Top nav keeps the wordmark + logout on mobile; links stay `hidden md:flex` and are served
  by `BottomTabs` instead.
- Protected layout renders `<BottomTabs>` and adds `pb-24 md:pb-0` to the content wrapper so
  the bar never covers the last element.
- Tab icons: `Home` → Dashboard, `Map` → Itineraries, `Users` → Trips, `User` → Profile
  (all already available from `lucide-react`).

**Itinerary — the bulk of the work**

- `itinerary-view.tsx`: header actions keep `flex-wrap` — **changed during build** from the
  planned horizontally scrollable row, because the status menu is `absolute top-full` and
  `overflow-x-auto` would clip it; title drops to `text-3xl`; card padding `p-5 md:p-7`;
  the edit-title pencil becomes always-visible below `md`
  (`opacity-100 md:opacity-0 md:group-hover:opacity-100`).
- `itinerary-map.tsx`: `h-[480px]` → `h-[280px] md:h-[480px]`, and `gestureHandling:
  'cooperative'` on the Maps options so one-finger drag scrolls the page instead of
  trapping it in the map.
- `day-schedule.tsx`: `draggable` and the drag handlers stay desktop-only; below `md` each
  card gets `ReorderButtons` wired to the same `onReorder(activityIds)` callback by
  splicing the array — no API change.
- `activity-card.tsx`: padding and type scale down a step; the edit/delete/expand row drops
  below the title on mobile so all three can be 44px targets — they do not fit beside the
  title alongside the reorder arrows at 375px.
- `timeline-view.tsx`: the seven axis labels crowd under ~400px, so the odd ones are hidden
  below `sm`, leaving four evenly spaced marks.
- Day tabs already scroll horizontally; add `scrollbar-width: none` and edge fade so the
  overflow reads as intentional.

**Modals — `regenerate-modal.tsx`, `edit-day-modal.tsx`, `create-trip-modal.tsx`**

- Below `md`: bottom-sheet presentation — `items-end md:items-center`, `rounded-b-none`,
  `max-h-[85dvh] overflow-y-auto`, `pb-[env(safe-area-inset-bottom)]`.
- `create-trip-modal` gains the `max-h`/`overflow-y-auto` it currently lacks.

**Forms & inputs — `hand-drawn-input.tsx`, `prompt-input.tsx`, `profile/edit/page.tsx`**

- Input font size floor of 16px on mobile: `text-base md:text-[15px]`.
- `profile/edit`: **smaller than budgeted** — the form was already single-column stacked
  cards with autosave and no submit button. Only card padding (`p-5 md:p-7`) and the
  `PillPicker` touch target (`py-3 md:py-2`) needed changing.

**Landing, quiz, dashboard, trips, profile**

- Hero/heading scale: `text-4xl sm:text-5xl md:text-7xl` in place of the current
  `text-5xl md:text-7xl` and `text-6xl md:text-7xl`.
- `quiz-question.tsx`: scale value `text-7xl` → `text-6xl md:text-7xl`; range slider thumb
  to 28px for touch.
- `auth-popover.tsx`: **expanded during build.** A width clamp was not enough. The desktop
  treatment is a bare transparent box that borrows the clean sky behind the nav; on a phone
  it lands on top of the hero headline and the two sets of white text collide into an
  unreadable overlap. Below `md` it becomes a real bottom sheet — own surface
  (`bg-slate-900/92`), scrim, grabber, slide-up entrance — with the input fills lightened
  and the CTA inverted, since dark-on-dark disappears against the panel. Desktop unchanged.
- `floating-hint.tsx`: **no change needed** — already `hidden md:block`.
- `profile/page.tsx` grids already collapse via `md:grid-cols-*`; verify only.
- `landing-hero.tsx`: `min-h-[calc(100vh-88px)]` → `100dvh`-based equivalent.

### Dependencies

None added.

## Behavior

**Navigation.** On a phone the bottom bar is always present on authenticated routes. The
tab matching the current pathname prefix is filled; the others are outlined. Tapping a tab
routes with the existing `PageTransition` cross-fade. On rotation to landscape the bar
stays (it is width-driven, not height-driven). At ≥768px the bar is not rendered at all and
the top nav links return.

**Reorder.** Below `md`, each activity card shows ▲/▼ at its trailing edge. The first
card's ▲ and the last card's ▼ are `disabled` with `aria-disabled`. A tap splices the
activity one position and calls the existing `onReorder`, which fires the same
`POST /api/itinerary/[id]/activities/reorder` the desktop drag does. A single activity in a
day shows both buttons disabled. Desktop behavior is byte-for-byte unchanged.

**Modals.** A modal opens as a sheet anchored to the bottom edge. If content exceeds
`85dvh` the sheet scrolls internally; the page behind does not. Tapping the backdrop closes,
as today. With the keyboard open, `dvh` keeps the sheet above it rather than behind it.

**Map.** A one-finger drag over the map scrolls the page (`cooperative` gestures); two
fingers pan the map. This is the standard Google Maps mobile contract and prevents the
common "scroll trap" where a full-width map makes the page unscrollable.

**Long content.** Destination names, itinerary titles and member emails are the realistic
overflow sources. Each gets `min-w-0` on its flex parent plus `truncate` (single-line
contexts) or `break-words` (multi-line), so a 60-character title wraps instead of forcing a
horizontal scrollbar.

**Safe areas.** On a notched device the bottom bar's content sits above the home indicator,
and the fixed top nav clears the status bar. On a device without insets `env()` resolves to
`0px` and nothing shifts.

## Verification

- `npm run build` and `npm run lint` clean.
- `npm test` — existing `itinerary-view.test.tsx` and `activity-card.test.tsx` must pass
  unchanged, proving desktop behavior did not move.
- New test `src/components/itinerary/day-schedule.test.tsx`: clicking ▼ on the first of
  three activities calls `onReorder` with the ids in `[2,1,3]` order; ▲ on the first is
  disabled.
- New test `src/components/layout/bottom-tabs.test.tsx`: renders four tabs and marks the one
  matching the mocked pathname with `aria-current="page"`.
- Manual pass at 375×667, 390×844 and 430×932 in the responsive inspector across
  `/`, `/dashboard`, `/quiz`, `/itinerary`, `/itinerary/[id]`, `/trips`, `/trips/[id]`,
  `/profile`, `/profile/edit`: no horizontal scroll, every action reachable, no zoom on
  input focus.
- Desktop regression check at 1440px on the same routes — should be pixel-identical.

## Risks / open questions

- **The bottom bar overlaps existing fixed UI.** `KanyeQuotes` regeneration overlay and the
  modals are `z-50`; the bar is `z-40`, so they cover it as intended. If any page adds its
  own fixed footer later, this needs revisiting.
- **`gestureHandling: 'cooperative'`** shows a "use two fingers to move the map" overlay on
  first touch. It is the correct trade against a scroll trap, but it is visible UI that did
  not exist before.
- **`dvh` support** requires Safari 15.4+ / Chrome 108+. Below that it falls back to the
  declared `vh` if we ship both declarations; the spec assumes we do.
- **Assumption:** the four nav destinations are stable. If a fifth is added the bottom bar
  needs a different pattern (five tabs at 375px is ~75px each — tight but workable; six is
  not).
- **`profile/edit/page.tsx` at 505 lines** is the one file where the mobile pass may surface
  layout problems that need judgment rather than a breakpoint. Budgeted as its own milestone.

## Status

Milestones 1–6 are landed on the `mobile-friendly` branch. `npm run build`, `npm run lint`
and `npm test` (389 tests, 7 new) are green.

Milestone 7 is **partially complete**: the automated half ran and passed; the manual sweep
at 375/390/430px has **not** been done, because launching the dev server was declined. The
protected routes need a live session to reach anyway. Everything below `md` is therefore
verified by construction and by test, not by eye.

Two implementation notes worth carrying forward:

- `BottomTabs` is mounted *inside* the protected layout's `z-10` wrapper, not as a sibling.
  That wrapper is a stacking context, so a page's `z-50` modal only outranks the `z-40` bar
  when both live in the same context. Moving the bar out would put it over every open modal.
- The `.pb-safe` utility replaces rather than adds to a Tailwind `p-*` bottom padding, so
  the sheets use `pb-[calc(1.25rem+env(safe-area-inset-bottom))]` instead. `.pb-safe` is
  correct only where the base bottom padding is 0 (the tab bar).

## Milestones

Each leaves the repo building and shippable.

1. **Foundation** — `dvh`, viewport export with `viewportFit: 'cover'`, safe-area utility,
   `background-attachment` fix, input 16px floor. Touches `globals.css`,
   `layout.tsx`, `hand-drawn-input.tsx`, `prompt-input.tsx`.
2. **Navigation** — `BottomTabs` + mount in the protected layout + content bottom padding.
   This alone makes the app navigable on a phone.
3. **Itinerary detail** — view, map, day schedule, activity card, timeline, reorder buttons.
   The densest surface and the core product.
4. **Modals & sheets** — the three modals plus `auth-popover` width clamp.
5. **Remaining surfaces** — landing, quiz, dashboard, trips, profile, `floating-hint`.
6. **Profile edit** — the 505-line form, on its own.
7. **Verification** — new tests, full manual sweep at the three widths, desktop regression.
