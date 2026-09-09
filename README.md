# Spotz

**Spotz turns a sentence into a night out.**

Say what you're actually trying to do — "R&B bars in Bed-Stuy," "something loud in Bushwick after 11," "cheap and outside" — and Spotz builds you a Move-list: real NYC events and spots, happening tonight, that match what you said.

Not a top-10 list. Not a chatbot you have to coax. One night, planned.

---

## What it is

A going-out planner for NYC. One city, one night at a time.

You give it one sentence. It hands back an ordered list of Moves — parties, functions, bars, popups — pulled from live event platforms and real places, arranged into an order that works geographically. Share the link and your friends vote 👍/👎 on each Move.

You have **one active Move-list** at a time. Previous nights fall into history. That constraint is the product: Spotz is for tonight, not for a folder of maybes.

**There is no quiz.** The prompt does all the steering.

## Who it's for

People who go out in New York and can tell the difference between "nightlife" and "R&B bars," and expect the system to honor that difference.

---

## How it works

### The core loop

1. **Say the word.** One prompt on the home screen.
2. **Watch it land.** Research finds candidates, the planner picks the Moves, the list appears.
3. **Send it to the group.** Share the link; friends vote on each Move. You keep edit control.

### Two modes, one pipeline

|                | Plan it (Fast)          | Send it (Deep)            |
| -------------- | ----------------------- | ------------------------- |
| For            | seeing what's out there | actually going            |
| You            | wait on screen          | walk away, get an email   |
| Latency        | ~15–30s                 | minutes                   |
| Quality target | strong draft            | polished, more iterations |

Fast is the default. Deep runs the fully agentic planner and advanced curation, then emails you when it lands.

---

## Where the Moves come from

Spotz never invents an event. Everything traces back to a source.

### The candidate pool

Source connectors pull live NYC events into a `candidate_events` pool on a schedule. **Generation reads the pool and never fetches sources live** — that decouples freshness from request latency, so a slow third-party endpoint can't stall a user's night.

| Source       | Endpoint                                                   | Status                                    |
| ------------ | ---------------------------------------------------------- | ----------------------------------------- |
| **Partiful** | `/discover` `__NEXT_DATA__` trending + `similarEvents` BFS | live                                      |
| **Posh**     | `posh.vip` BFF explore, cursor pagination                  | live — currently 403s from datacenter IPs |
| **Luma**     | `api.lu.ma` discover, NYC place id                         | live                                      |
| **TikTok**   | commercial scraper API                                     | stubbed, disabled                         |

Ingestion runs every 4 hours via Vercel cron (`vercel.json` → `/api/ingest`, gated by `CRON_SECRET`, writes with the service role). Each connector is independently disableable with `SOURCE_<NAME>_ENABLED`.

Every candidate carries provenance: `source`, `sourceId`, `sourceUrl`, and the untouched `raw` payload. A candidate that fails its Zod schema is skipped — never repaired by guessing. Duplicates of the same party across platforms are collapsed deterministically (normalized title + date, source-priority tiebreak).

These are all **undocumented third-party internals** that can change or block without notice. Connectors parse defensively and stay polite: sequential requests through a shared delay, bounded pagination.

### Plus web research

**Tavily** search, driven by the prompt's extracted intent, with an LLM extractor turning snippets into structured candidates and a scorer ranking them. **Google Places** verification enriches and confirms real addresses. Undated, unlocated spots stay eligible — a bar without a Places entry is still a bar.

---

## What Spotz is not

- **Not a trip planner.** One night in one city. No multi-day itineraries, no Lisbon.
- **Not a booking platform.** Tickets, reservations, tables — out of scope.
- **Not a content site.** Nothing pulled off a shelf.
- **Not a chatbot.** You don't negotiate with it. Conversation refines an existing list; it doesn't create one.
- **Not a group-planning tool.** Share links and votes, deliberately. No roles, no membership, no governance.

---

## Tech stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Auth & DB:** Supabase (Postgres, RLS, Realtime, OAuth)
- **AI:** OpenAI via the Vercel AI SDK
- **Web research:** Tavily
- **Maps:** Google Maps + Places
- **Email:** Resend (Deep mode delivery)
- **Deploy:** Vercel — `waitUntil` for Deep mode, cron for ingestion
- **Validation:** Zod everywhere — the schema is the contract between pipeline steps
- **Testing:** Vitest, fixture-based (connectors never hit the network in tests)
- **Styling:** Tailwind CSS, hand-drawn components, Caveat + Inter

---

## Getting started

### Prerequisites

- Node 18+
- A Supabase project
- API keys: OpenAI (required), Tavily (required for research), Google Maps (required), Resend (optional, Deep mode email)

### Setup

```bash
git clone <repo>
cd aspot_monolith
npm install
cp .env.example .env.local        # then fill in keys
npm run dev
```

### Environment

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # ingestion + shared-link reads; server only

# AI + research
OPENAI_API_KEY=
TAVILY_API_KEY=

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SERVER_KEY=

# Ingestion cron
CRON_SECRET=                    # Authorization: Bearer <secret> on /api/ingest

# Source connectors (all default on except TikTok)
SOURCE_PARTIFUL_ENABLED=
SOURCE_POSH_ENABLED=
SOURCE_LUMA_ENABLED=
SOURCE_LUMA_PLACE_ID=
SOURCE_TIKTOK_ENABLED=false

# Deep-mode email (optional)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_SITE_URL=
```

### Database

Migrations live in `supabase/migrations/`, applied in order. The Spotz pivot is `016`–`019`; `016` is **destructive** (drops the trips/quiz tables, renames `activities` → `plans`).

`supabase db push`, or paste them into the Supabase SQL editor. Note that `017` and `018` are not re-runnable as written.

### Triggering ingestion manually

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/ingest
```

Returns per-source `fetched`/`written` counts. **`ok: false` with a `207` means a source failed** — check `failedSources`.

---

## Project layout

```
src/
├── app/
│   ├── (protected)/        dashboard, itinerary, profile
│   ├── api/                itinerary, ingest, plans (votes), shared
│   ├── s/[code]/           public shared Move-list
│   └── auth/               OAuth callback
├── components/
│   ├── itinerary/          prompt pill, Move-list, votes, share, map
│   ├── landing/            hero, auth popover
│   └── dashboard/ ui/
├── lib/
│   ├── sources/            connectors + candidate pool  ← the Moves supply chain
│   ├── ai/                 prompt parser, agents, Tavily, cache
│   ├── itinerary/          CRUD, versioning, shares + votes
│   ├── time/               NYC-anchored night windows (servers run UTC)
│   ├── maps/ email/ calendar/ ratelimit/ preferences/
│   └── supabase/           client / server / service-role
└── types/                  shared contracts
```

Each significant directory carries an `AGENTS.md` describing its contracts — start with the root one.

---

## Scripts

| Command                 | What it does             |
| ----------------------- | ------------------------ |
| `npm run dev`           | Local dev server         |
| `npm run build`         | Production build         |
| `npm start`             | Run the production build |
| `npm run lint`          | ESLint                   |
| `npm run format`        | Prettier write           |
| `npm run format:check`  | Prettier check           |
| `npm test`              | Vitest, single run       |
| `npm run test:watch`    | Vitest, watch mode       |
| `npm run test:coverage` | Vitest with coverage     |

---

## Notes for contributors

- **Servers run UTC; the product is Eastern.** Never use `Date.prototype.setHours` to reason about "tonight" — use `src/lib/time/nyc.ts`. This bug class is invisible on an Eastern laptop and wrong in production.
- **Connectors fetch and normalize only.** `pool-service` owns every database write.
- **A failing source must be loud.** `fetched: 0` is indistinguishable from a quiet night, so a first-page failure throws rather than returning an empty list.
- **Share codes are capabilities.** Shared reads run on the service role because knowing the unguessable code _is_ the permission; RLS grants no blanket shared-read.

---

## Where this is going

1. Resolve the Posh 403 — browser-context headers, a proxy, or drop the source.
2. TikTok connector behind a commercial scraper API.
3. Reddit-targeted research for the long-tail local truth travel SEO buries.
4. Eval harness — canonical prompts run on every release, so quality regressions get caught before users do.
