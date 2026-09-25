# Spotz — Data Sourcing Strategy ("getting the data")

> Status: REVISED — founder set priority order: **#1 Partiful, #2 Posh, #3 TikTok, #4 Luma**. These are the culture sources; ticketing APIs are backfill, not the product. ToS risk on Partiful/Posh acknowledged and accepted; mitigations: polite volume, provenance kept, swap-ready architecture.
> Technical recon COMPLETE 2026-09-03. Extraction recipes below.

## Priority sources — verified extraction recipes

### #1 Partiful — ✅ EXTRACTABLE (verified live)

- **Stack:** Next.js on Vercel + Firebase backend. Plain curl with browser UA works; no anti-bot wall hit.
- **Discovery:** `partiful.com/discover` (→ `/explore`) SSR-embeds `__NEXT_DATA__` → `pageProps.trendingSections.NYC` — "Trending in NYC · Public events you can crash" (carousel, ~5 items/section; sections NYC/LA/SF).
- **Expansion:** each event's `_next/data/<buildId>/e/<eventId>.json` route returns full event JSON **plus `similarEvents` (5 more NYC events each)** → crawl the similarity graph from trending seeds to grow the pool.
- **Event JSON** (`__NEXT_DATA__` or `_next/data` route): `startDate`/`endDate` (ISO), `locationInfo.mapsInfo.name` + `addressLines` (e.g. "Space Bushwick, 839 Broadway"), `description`, `displaySettings` (theme), guest counts (`goingGuestCount`, `approvedGuestCount` — hype signal!), `publicShortUrl`, `calendarFile` (.ics), `sitemapLastModifiedAt`.
- **Also:** Google indexes event pages → SerpAPI `site:partiful.com` queries seed more URLs. Build ID rotates per deploy — re-scrape it from any page's `__NEXT_DATA__`.
- **Caveats:** trending = curated subset, not exhaustive; most Partiful events are invite-only and never surface (that's fine — "public events you can crash" is exactly our product).

### #2 Posh — ✅ EXTRACTABLE (best-in-class, verified live)

- **Stack:** Next.js App Router behind Cloudflare; **plain curl works, no auth, even empty UA**.
- **The endpoint:** `GET https://posh.vip/api/bff/v1/explore/events?lat=40.7128&lng=-74.006&timezone=America/New_York&cursor=<n>` — cursor pagination, JSON list of NYC events. City enum incl. `new_york_city`; filters: Today / This Week / This Month, `maxPrice`.
- **Enumeration:** sitemaps! `sitemap-events-1..6.xml` + `sitemap-events-recent.xml` (thousands of `/e/<slug>` URLs, plain curl).
- **Event detail:** `/e/<slug>` pages with embedded state (venue, time, price, lineup); `/g/<slug>` group pages for recurring promoters.
- **Caveats:** robots.txt disallows `/api/` for crawlers (we're calling it anyway — accepted risk); geo radius fuzzy (NYC query returned some NJ venues — post-filter by coordinates); Cloudflare could tighten anytime.

### #3 TikTok — ⚠️ VIA COMMERCIAL SCRAPER API (no direct route)

- Official APIs are dead ends for us: Research API = academic-only + 15-day retention + no commercial use; Display API = own-account only; oEmbed = single known URLs.
- Open-source scraping (TikTokApi) = constant msToken/signature breakage. Not build-on-able.
- **Route:** commercial scraper API (Apify TikTok scrapers / EnsembleData / ScrapeCreators / TikAPI) — hashtag feeds + creator feeds + captions/metadata as JSON.
- **Pipeline:** curated NYC hashtag + creator list → daily pull → captions (+ transcript/OCR later) → LLM extracts venue/event/date/vibe → verify against Google Places (provenance rule: TikTok candidates MUST resolve to a real place or get dropped).
- Creator-list approach > hashtag search: cheaper, higher signal, culture-curated. The list is editorial value, same as the Eventbrite venue list.
- **Cost:** roughly $20-100/mo at daily refresh for a handful of hashtags/creators depending on vendor. Vendor bake-off = first implementation task.

### #4 Luma — ✅ EXTRACTABLE (cleanest of all, verified live)

- **The endpoint:** `GET https://api.lu.ma/discover/get-paginated-events?discover_place_api_id=discplace-Izx1rQVSh8njYpP&pagination_cursor=<cursor>&pagination_limit=25` — **NYC place id verified, no auth, clean cursor pagination, zero overlap between pages**.
- Full event objects: `name`, `start_at`/`end_at`, timezone, `coordinate` (**precise lat/lng even when street address is guests-only**), hosts/calendar (with socials + verified flag), `guest_count`, `ticket_info`, cover images.
- Sister endpoints seen in JS: `/discover/get-place`, `/discover/get-calendar...`.
- `luma.com/nyc` SSR `__NEXT_DATA__` as fallback; plain HTTP + normal UA works everywhere.
- **Caveats:** undocumented internal API — can change/require auth anytime; wrap in the same swap-ready source interface.

## Ingestion architecture (all four sources)

- One `EventSource` interface: `fetchCandidates(): RawCandidate[]` per source, normalized into a shared `candidate_events` pool (Supabase) with provenance (source, source_url, fetched_at, raw payload).
- **Scheduled polling** (Vercel cron or Supabase pg_cron): Posh + Luma every ~3-6h (cheap, paginated), Partiful trending + similar-graph ~6h, TikTok daily. Never fetch at generation time.
- **Politeness:** low volume, delays between requests, normal browser UA, no parallel hammering. Each source independently disableable via flag (swap-ready).
- Dedupe across sources (same party often on Posh + Partiful): fuzzy match on name + date + venue coords.
- LLM normalization pass: raw payload → `CandidateEvent` schema (Zod), vibe tags, price tier.


## The question

Can Spotz reliably know what's happening in NYC **tonight** — events, functions, parties, popups, food spots — legally and on a startup budget?

## Verdict table

| Source | Access | Verdict | Notes |
|---|---|---|---|
| **Ticketmaster Discovery** | Free API key, self-serve, 5k calls/5hr | ✅ **VIABLE** | Big ticketed events: MSG, Barclays, Broadway, concerts. `city=New York` + date filter. Weak on clubs/popups/free |
| **SeatGeek** | Free client ID (OAuth2) | ✅ **VIABLE** | Complements TM; easy "tonight" query (`venue.city` + `datetime_utc`). Same underground blind spot |
| **NYC Open Data / Parks** | Free, open | ✅ **VIABLE** | Free/public events, street fairs, park stuff |
| **SerpAPI Google Events** | ~$25/mo | ⚠️ **VIABLE (transitional)** | Broadest long-tail (pulls Meetup/Eventbrite/AllEvents via Google), native "today" chip. Scraping-adjacent legality; treat as MVP filler to be replaced |
| **Eventbrite** | Free key, but public search API killed in 2019 | ⚠️ **PARTIAL** | Only by-venue / by-organizer endpoints. Route: curate NYC venue+organizer ID list, poll their events. Broad discovery requires Distribution Partner Program (apply) |
| **Luma (lu.ma)** | Official API is manage-your-own-calendar only ($59/mo Plus) | ⚠️ **PARTIAL** | No city discovery endpoint. luma.com/nyc explore page exists (~100 NYC events) but that's scraping (ToS-gray). Get-event-by-ID works officially for enrichment |
| **Resident Advisor** | No public API; undocumented GraphQL (`api.ra.co/graphql`) works unauthenticated | ⚠️ **PARTIAL (gray)** | Best-in-class NYC nightlife data. ToS prohibits scraping without written agreement. Community scrapers work today but can break/block anytime |
| **DICE** | Partner-only GraphQL | ❌ **DEAD-END** without partnership | Club-night vertical; open a partnership conversation |
| **Partiful** | No API, ToS bans scraping + competitor clause | ❌ **DEAD-END** | Worst-case legal posture for us specifically. Monitor for future API |
| **Posh** | No API, explicit anti-scraper ToS | ❌ **DEAD-END** (clean) | Partnership or nothing |
| **Food spots** | Existing Tavily + Google Places pipeline | ✅ **ALREADY BUILT** | Carries over from aSpot |

## Recommended MVP stack (all legal, ~$25/mo + existing API spend)

1. **Ticketmaster + SeatGeek** — the ticketed backbone (concerts, shows, sports). Free.
2. **SerpAPI Google Events** — the long tail (community events, Meetup, Eventbrite events surfaced via Google) with same-day freshness. ~$25/mo.
3. **NYC Open Data / Parks feeds** — free/public events. Free.
4. **Eventbrite venue/organizer polling** — hand-curate a list of ~50-100 NYC venues + recurring party organizers, poll their event feeds. Free, fully sanctioned, and it targets exactly the popup/function scene the ticketing giants miss. The curated list IS editorial value.
5. **Tavily + Google Places** (existing) — food spots + venue enrichment (geo, hours).
6. **LLM curation layer** (existing pipeline) — merges, dedupes, ranks, and matches the pool to the prompt vibe. This is where "curated, not a listings scroll" happens.

## Partnership track (parallel, async)

- Apply: **Eventbrite Distribution Partner Program** (broad search access).
- Email: **DICE** partnership (club vertical), **RA** written data agreement.
- Monitor: Partiful/Posh for API launches.

## Explicitly deferred

- RA GraphQL scraping: tempting (best nightlife data) but undocumented + ToS-prohibited. Decision deferred; pursue the written-agreement route first.
- Luma explore-page scraping: ToS-gray; revisit only if the function/popup coverage gap proves painful.

## Freshness architecture implication

"Tonight" kills the old ~1-week research cache. New model:
- **Events pool**: refreshed on a schedule (e.g. every 2-6h per source) into a `candidate_events` store, NOT fetched per-request — keeps generation fast and rate limits safe.
- **Food spots**: can keep a longer cache (days) — restaurants don't churn nightly.
- Generation reads from the pool; provenance carries source + fetched-at timestamp.

## Non-negotiable

**Spotz never invents places or events.** Every plan carries provenance (source, URL, fetched-at). A hallucinated party is a product-killing bug.
