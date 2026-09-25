# Spotz — Product Definition

> Status: APPROVED 2026-09-02 — product definition signed off. Next phase: data sourcing.
> Formerly aSpot. Pivot: NYC-only, one itinerary at a time, centered on **finding the Moves** — tonight's events, functions, parties, popups, and food spots.

## Opening line

> **"Yurrrrr, what's the word bro"**
>
> *find the Moves for tonight*

That's the voice. NYC-native, zero corporate. The copy talks like your friend who always knows where it's at.

## One-liner

**One prompt in → the Moves for tonight.** A curated run of real events, functions, parties, popups, and food spots in NYC — then your friends jump in and vote on it.

Not a listings site, not a chatbot, not a travel app.

## Who it's for

You and your people in NYC with a free night (or day) and no plan. "Something's always happening — where?" Spotz answers with a curated itinerary, not an infinite scroll of events.

## The core loop

1. **Prompt.** "Yurrrrr" → one sentence: *"moves for tonight, Brooklyn, we tryna dance"*, *"chill Sunday, good food, no cover"*.
2. **Spotz finds the Moves.** Real, currently-happening things: events, functions, parties, popups, food spots — curated into one ordered itinerary for the night/day. Every pick is real, sourced, and time-aware.
3. **Share it.** One link. Friends join the itinerary.
4. **They vote.** 👍 / 👎 on specific plans (individual spots/events) in the itinerary. The group sees where the energy is at.
5. **Adjust.** Swap what got thumbed down, reorder, regenerate. Then go.

## The core objects

### The Itinerary (the Move-list)
- **One active itinerary per user.** New one archives the old into a quiet view-only history.
- An ordered, time-aware run of plans for a specific night/day. **Anchored to real time** — "tonight" means tonight; events have doors, sets, closings.
- NYC always. **Neighborhood-aware**: "in Bushwick" steers it; default anywhere in the city.
- Alive after generation: swap, reorder, regenerate, revert.
- **Shareable** — one link, friends join, no accounts gymnastics beyond a simple sign-in.

### The Plan (one stop in the itinerary)
A real event or spot: what it is, where, when (doors/hours), the vibe, why it was picked, rough damage ($), map pin, link out (tickets/RSVP where they exist).

Types: **event · function · party · popup · food spot**.

### The Vote
👍 / 👎 by a joined friend on a specific plan. Lightweight reactions — no deadlines, no approval workflow, no organizer roles, no RSVPs. The itinerary owner keeps edit control; votes are signal, not governance.

## The experience

- **Land → one input.** The "Yurrrrr" prompt box. No forms.
- **Two modes:**
  - **"Plan it" (Fast)** — the Moves build on screen while you watch.
  - **"Send it" (Deep)** — heavier hunt and curation in the background; lands in your email and the app.
- **Live with it.** Schedule, timeline, map. Share link out. Watch the thumbs come in. Adjust. Go.

## Personalization

**None at launch.** No quiz, no preference profile. The prompt carries everything — vibe, budget, crew, neighborhood, energy. Auth stays minimal: itineraries belong to you, history is yours, friends sign in to vote.

## The data problem (the real product)

Spotz is only as good as its knowledge of **what's actually happening in NYC tonight**. Generic web search alone won't cut it. Sourcing strategy is the next major workstream — candidates:

- Event platforms: Eventbrite, Dice, RA (Resident Advisor), Luma, Partiful, Posh
- Popup/food discovery: web research, editorial feeds (The Infatuation, Time Out), IG-adjacent signals
- Baseline: Tavily research + Google Places (already built) for food spots and venues

**Non-negotiable inherited rule: Spotz never invents places or events.** Every plan has provenance. A hallucinated party is a product-killing bug.

→ Decide sourcing mix, access/API realities, and freshness pipeline in the next phase ("getting the data").

## What this product is NOT

- ❌ Multi-day trips, destinations, travel anything
- ❌ Heavy group machinery: no member roles, suggestion queues, voting deadlines, RSVPs
- ❌ A dashboard of itineraries — one active, plus quiet history
- ❌ A quiz/onboarding flow
- ❌ An events listings/scroll site — curation into one itinerary IS the product

## What survives the pivot

- Hand-drawn aesthetic — cards, tape, post-its, human typography. Still the product's skin.
- Provenance rule — never invent places (now: never invent events either).
- Schema-validated pipeline: Understand → Discover → Rank → Plan → Critique → Persist.
- Fast/Deep modes, versioning + revert, calendar export, rate limiting, Supabase auth + realtime (now powering live votes).

## Language (everywhere — UI, code, DB)

| Old | New |
|---|---|
| aSpot | **Spotz** |
| Activity | **Plan** (a stop: event/function/party/popup/food spot) |
| Itinerary | **Itinerary** (the Move-list — keeps its name) |
| Trip / destination / members | *(gone)* |
| — | **Moves** (product voice for what Spotz finds) |
| — | **Vote** (👍/👎 on a plan) |

## Open questions (for the data phase, non-blocking on sign-off)

1. Sourcing mix + API access per platform (Eventbrite/Dice/RA/Luma/Partiful) — legality, rate limits, freshness.
2. Do voters need full accounts, or lightweight join (name + emoji) on a shared itinerary?
3. "Tonight" freshness: how close to real-time must the event pool be? (Cache strategy changes completely vs. the old ~1-week research cache.)
4. History depth: unlimited until it's a problem.
