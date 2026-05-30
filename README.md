# aSpot

**aSpot turns a sentence into a trip.**

Say what you actually want — "2 nights in NYC for R&B bars," "long weekend in Lisbon, vegan food and tile museums" — and aSpot does the research, builds the days, and hands you a real itinerary that reflects what you said. Not a top-10 list. Not a chatbot you have to coax. A trip.

---

## What it is

A travel planner for people who care about the *feel* of a trip, not a checklist.

You give it one sentence. It gives you a day-by-day plan with real places — bars, restaurants, attractions — chosen to match the vibe you described, the dates you're going, and the taste profile you set up once during a short onboarding quiz. You can drag activities around, regenerate a single day with another sentence ("more food, less museums"), revert if you go too far, and share the trip with the people you're traveling with.

The product's promise is simple: **say it, get it.**

## Who it's for

Taste-driven travelers. The kind of person who can tell you the difference between "nightlife in NYC" and "R&B bars in NYC" and expects the system to honor that difference. The aesthetic — hand-drawn cards, taped post-its, a sky video, "Plan it" in human typography — is the tell. This isn't business travel. It's the trip you actually want to take.

A short quiz captures the baseline (pace, comfort zone, cuisines, social style, authenticity preference). The prompt overrides the quiz when they conflict. **Profile is the floor; prompt is the steering wheel.**

---

## How it works

### The core loop

Three moments matter:

1. **Tell us what you want.** A single prompt pill on the home screen. One sentence in.
2. **See it appear.** The trip surfaces piece by piece — research finds candidates, the planner picks them into days, the result lands. No 30-second blank wait.
3. **Make it yours.** The first version is a strong opinion, not a final answer. Drag, swap, regenerate, revert.

### Two modes, one pipeline

The same engine runs in both modes. The difference is whether you're playing or planning.

| | Plan it (Fast) | Send it (Deep) |
|---|---|---|
| For | exploring possibilities | actually going on the trip |
| You | wait on screen | walk away, get an email |
| Latency | ~15–30s | minutes |
| Quality target | strong draft | polished, more iterations |

Both produce real trips. Fast is the default; Deep is for when you're committing.

### The pipeline

Every itinerary — fast or deep, brand new or single-day edit — goes through the same six steps:

```
prompt + profile
    ↓
1. Understand    → structured trip brief (theme, must-haves, deal-breakers)
2. Discover      → real candidates from real sources, with provenance
3. Rank          → score against intent + profile, keep top-N
4. Plan          → arrange into days with geography and pacing
5. Critique      → does it serve the brief? surgical fixes only
6. Persist       → save and stream to the screen as it lands
```

Each step has one job and a typed contract with the next. Editing a single day is the same pipeline at a smaller scope.

---

## Research: where the trip comes from

The system never invents places. Research is the part that earns the trust.

**Today (live):**
- **Tavily** for web search, queried with the user's prompt-derived intent (the focus, vibe, must-haves) plus their quiz preferences. Three parallel searches: attractions, restaurants, activities.
- **An LLM extractor** turns the search snippets into structured candidates (real names, descriptions, price ranges, ratings).
- **A scorer** ranks candidates against the user's intent and profile, keeps the top-N per category, and hands them to the planner.
- **Disk cache** keyed by `destination + intent` so the same prompt doesn't re-pay the network cost within a week.

**Where it's going (next):**
- **Reddit-targeted searches** for the long-tail local truth that travel SEO buries.
- **Google Places verification** as a hard filter — anything search/Reddit names gets confirmed against a real address before it can reach the planner. Structural defense against hallucination.
- **Provenance carried through every step** so the planner can say "I picked this because it's a 4.6-star R&B-leaning bar with three Reddit threads calling it a local favorite," not just "I picked this."
- **Date-aware events** (Eventbrite/Resy/Ticketmaster) when trip dates fall in a window where a specific show or pop-up is the obvious right answer.

---

## What aSpot is not

- **Not a booking platform.** Reservations, flights, hotels — out of scope.
- **Not a content site.** No SEO articles, no top-10 lists. Output is generated for you, not pulled off a shelf.
- **Not a chatbot.** You don't negotiate with it to get a trip. Conversation is reserved for *refining* an existing trip, not creating one.
- **Not a SaaS dashboard.** If it ever feels like one, the product is broken.

---

## Tech stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Auth & DB:** Supabase (Postgres, RLS, Realtime, OAuth)
- **AI:** OpenAI via the Vercel AI SDK
- **Web research:** Tavily
- **Maps:** Google Maps + Places (display today, verification soon)
- **Email:** Resend (delivery for Deep mode)
- **Deploy:** Vercel (`waitUntil` for Deep mode background work)
- **Validation:** Zod everywhere — the schema is the contract between every pipeline step
- **Styling:** Tailwind CSS, custom hand-drawn components, Caveat + Inter

---

## Getting started

### Prerequisites

- Node 18+
- A Supabase project
- API keys: OpenAI (required), Tavily (required for live research), Google Maps (required for maps), Resend (optional, for Deep mode email)

### Setup

```bash
git clone <repo>
cd aspot_monolith
npm install
cp .env.local.example .env.local   # then fill in keys
npm run dev
```

### Environment

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI + research
OPENAI_API_KEY=
TAVILY_API_KEY=

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Deep-mode email (optional)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_SITE_URL=
```

### Database

Migrations live in `supabase/migrations/`. Apply them with `supabase db push` or paste them into the Supabase SQL editor in order.

---

## Project layout

```
src/
├── app/
│   ├── (protected)/        dashboard, itinerary, trips, quiz, profile
│   ├── api/                generate, regenerate, edit-day, trips, etc.
│   └── auth/               OAuth callback
├── components/
│   ├── itinerary/          search pill, view, day schedule, map, edit modals
│   ├── trips/              create, invite, members
│   ├── quiz/               flow, questions, progress
│   └── ui/                 hand-drawn primitives
├── lib/
│   ├── ai/                 prompt parser, agents, Tavily service, cache
│   ├── itinerary/          CRUD, versioning, day regeneration
│   ├── preferences/        quiz → profile, scoring/curation
│   ├── trips/              collaboration
│   ├── maps/               Google Places + maps
│   └── supabase/           client/server/middleware
└── types/                  shared TypeScript contracts
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |

---

## Where this is going

The bet is that **personalization compounds**. Every trip you take, every edit you make, every "yes this worked / no it didn't" should sharpen aSpot's read on your taste. Trip ten should feel like it was planned by a friend who knows you.

Near-term priorities, in order:

1. Schema-enforced agent outputs (no more regex-extracting JSON).
2. Streaming the trip to the screen as it generates (no blank waits).
3. Reddit + Google Places in the research pipeline.
4. A model registry so the planner-vs-extractor models are swappable from one place.
5. Eval harness — a small set of canonical prompts the system runs against on every release, so quality regressions get caught before users do.
