# NYC event discovery: source contracts and evidence

Reviewed against public sources on **2026-10-22**. Product priority remains Partiful → Posh → Luma. TikTok is an investigation, not a working feed. Technical accessibility does not establish permission to commercially reuse a platform's data.

## Implemented access and observed limits

| Source       | Implemented path                                                                                   | Live observation                                                                       | Limitation                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Partiful     | `/discover` SSR `__NEXT_DATA__`, then `/_next/data/<buildId>/e/<id>.json`; similar-event traversal | `/discover` redirects to `/explore`; NYC seeds and one hydrated event succeeded        | Undocumented; public trending subset, at most 60 hydration attempts, depth 2                                                   |
| Posh         | `/api/bff/v1/explore/events` with NYC coordinates and cursor                                       | 100 listings across five pages ingested from Vercel using the Spotz service User-Agent | Bounded coverage, not a complete NYC catalog; no access-bypass fallback                                                        |
| Posh details | Public event-page JSON-LD, including complete JSON objects inside Next string transport            | Negril Village R&B page parsed successfully                                            | Opt-in `SOURCE_POSH_DETAILS_ENABLED=true`; at most 12 existing discovery candidates per run; stops enrichment on fetch failure |
| Luma         | `api.lu.ma/discover/get-paginated-events`, NYC place id                                            | First page returned 10 entries with nested event location and ticket info              | Undocumented; six-page cap; repeated/missing cursors report partial coverage                                                   |
| TikTok       | Explicit disabled stub                                                                             | No TikTok ingestion performed                                                          | Enabling it raises “not implemented,” rather than claiming successful ingestion                                                |

Partiful and Posh's terms restrict scraping without authorization; the existing connectors are experimental technical integrations, not approved commercial feeds. Pursue permission or organizer-supplied data before treating either as dependable licensed supply. See [Partiful terms](https://partiful.com/terms) and [Posh terms](https://posh.vip/terms/terms-of-service).

Luma's documented API requires Plus and a key scoped to a calendar. It is a viable future integration for participating organizers, not a documented replacement for city-wide discovery. [Luma API requirements](https://docs.luma.com/reference/getting-started-with-your-api).

### Posh access diagnostics

Posh requests identify the server as `Spotz/1.0 (+https://spotz-xi.vercel.app)`. The shared fetch helper raises `SourceHttpError` for HTTP failures and for responses explicitly marked `cf-mitigated: challenge`, even if their HTTP status is 200. It records only a validated Cloudflare Ray identifier and the challenge classification, never response bodies or cookies. Challenges are not retried or parsed as event data. A plain 403 without that header is not classified as a challenge. [Cloudflare's response detection contract](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/).

When server access is challenged, obtain an approved feed or request Posh-side authorization for the integration, supplying the Ray identifier and UTC request time. Only the website owner controls whether its Cloudflare challenge is presented. Posh's documented organizer webhooks cover orders and registrations; they do not document a city-wide event discovery feed. [Cloudflare resolution guidance](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/resolve-challenge/), [Posh integration documentation](https://support.posh.vip/en/articles/15091630-mailchimp-webhooks-connecting-external-tools).

## Extraction and shared pool

`RawCandidateSchema` and `EventDetailsSchema` in `src/lib/sources/types.ts` are the normalization boundary. Connectors do not write to the database. `pool-service.ts` persists source identity, source URL, original payload, fetch time, event times, and structured facts.

- Posh's observed BFF uses `url`, `startDate`, `endDate`, `venueName`, and `minTicketPrice`; older aliases still parse. Zero minimum price is not unconditional free admission. Currency and availability stay unknown unless explicitly supplied. Page JSON-LD can supply USD price and offer status; Posh's internal `start` field is a wall clock mislabeled `Z`, so it is deliberately not used.
- Luma coordinates and `geo_address_info` can be nested under `event`. Public Google place ids are namespaced for venue matching. City/area is not treated as a venue. Guests-only/obfuscated locations do not expose coordinates or street addresses in normalized candidates. The verified USD price shape is `{cents, currency: "usd", is_flexible}`; other monetary shapes remain unknown. `waitlist_enabled` is configuration, not a ticket-status claim.
- Partiful uses `locationInfo.displayName`, `displayAddressLines`, and maps metadata. Unknown prices remain unknown. `PUBLISHED`, cancellation flags/status, disabled RSVPs, and capacity signals normalize separately from event times.
- Explicit source music mentions carry the exact supporting text and field. Categories are conservative literal labels. This does not infer genre from an artist or venue name and does not replace the itinerary model's semantic theme assessment.
- Offset-less/invalid timestamps remain unknown; the server timezone never supplies a missing offset. Contradictory ends are omitted and recorded as issues. No source, caption, model, or geocoder may invent an event date.
- Each source/id appears once per database upsert. Across sources, dedupe requires shared identity/URL, or matching full Unicode-normalized title, close published times (within 90 minutes), and compatible venue evidence. Unknown venues remain separate. Different sessions with distinct same-platform ids remain separate. Freshest evidence wins, then source priority; merged listings retain links and conflicts. Fresh cancellation/sellout evidence cannot be erased by an active cross-listing.

## Freshness, cancellation, and coverage

Migration `021_event_details.sql` adds `details` and clears legacy ambiguous `is_free=false` values to NULL. Its update trigger preserves earlier cancelled/postponed and sold-out/closed states when a new summary reports only unknown status. Explicit source state can clear restrictions. Apply it before deploying readers/writers that use `details`. No new authenticated write permissions are granted.

The existing `/api/ingest` cron runs every four hours. First-page failures and malformed envelopes fail the source. Partial pagination/detail/hydration failures retain successful candidates and produce `partialSources` with warnings and HTTP 207. `failedSources` identifies total failures. A clean run returns 200. Bounded sampling still is not full city coverage.

The independent Spotz Vercel Hobby deployment uses `vercel.spotz.json`: one scheduled ingest daily at 21:00 UTC, plus authorized manual runs. This cadence is separate from the existing deployment and does not weaken the 24-hour observation limit; delayed or failed runs can leave an empty eligible pool.

Both itinerary generation and the conversation endpoint use `getTonightPool`. Reads enforce a **24-hour maximum observation age**, source links, real dates, and a half-open night boundary at 6am Eastern. They exclude cancelled, postponed, sold-out, registration-closed, expired, and ended events. Published starts must fall inside the requested night window. Ongoing events within that window require a published end; a multi-week range beginning on an earlier night is not evidence of an occurrence tonight. Unknown-date events remain stored but cannot claim to happen tonight. A vanished discovery result is not inferred to be cancelled; it ages out of recommendations. There is no automatic live recheck during a request. The conversational reply warns when the observation is over four hours old and treats availability as a source report.

Expiry removes ended rows, or uses start + 12 hours as a storage fallback; this fallback never becomes an event end time. Undated rows expire after one day. A source outage does not refresh old rows.

## Recorded live validation

Reduced public-event fixtures live in `src/lib/sources/__fixtures__`; private guest/host/account metadata is omitted. `extraction.test.ts` exercises those payloads. `discovery/conversation.test.ts` replays them with a fixed clock; replay assertions are not promises of present ticket availability.

- [Laila! Presents CLUB GENIUS](https://posh.vip/e/laila-presents-club-genius): BFF start `2026-10-23T01:00:00Z`, end `06:00:00Z`, venue `525 Waverly Ave`, minimum price 0. The old connector lost these fields. No genre or unconditional free entry is inferred.
- [THE FUR AFFAIR](https://posh.vip/e/the-fur-affair-1): a past October 16 event appeared in the current discovery page. Replay verifies it cannot be recommended for October 22.
- [Yours Truly, R&B at Negril Village](https://posh.vip/e/yours-truly-rb-every-thursday-at-negril-village-2026-10-23-4-15): public structured data gives October 22 at 8pm EDT through October 23 at 12:15am, the venue/address, USD zero-price offer, and `InStock`. The prose says midnight; the parser preserves the structured timestamp, rather than reconciling that discrepancy by guessing. This page validates extraction and the recommendation replay; it was not observed in the fetched first discovery page.
- [Coffee & Apple Ads Masterclass](https://lu.ma/06hgn26s): nested obfuscated location, explicit free status, and approval-required registration. Tests verify exact coordinates stay hidden and available spots do not override approval requirements.
- Luma's paid-event fixture verifies a 1000-cent USD offer becomes $10 and a public Google place id is retained.
- [DIONYSUS HALLOWEEN](https://partiful.com/e/B9X0Wtx8YG2XNpRb6Teh): ACE HOTEL display address and October 31 night window crossing the DST transition. Price remains unknown.
- `posh-long-range-live.json` preserves VELVET NIGHTS' published October 2–25 range. The October 22 conversation replay excludes it because its start falls outside that night's window, while retaining a real October 22 R&B listing. Source timestamps remain unchanged.

Synthetic cases separately test cancellations, conflicting cross-listings, malformed data, outages, unknown prices, sold-out listings, and DST repeated hours. These are not represented as live observations.

Production validation on **2026-10-22 at 11:02 EDT** used the independent [Spotz deployment](https://spotz-xi.vercel.app), after applying migrations 021 and 022 to the supplied Supabase project. The authorized ingest returned HTTP 207: Partiful fetched/wrote 53 candidates, Luma fetched/wrote 88, and Posh's first page returned HTTP 403 from Vercel. One expired row was removed; the pool then held 321 rows. The authenticated R&B-tonight request returned HTTP 200 with `status: no_matches` for October 22. This establishes that the deployed route works with live data, not that NYC has no R&B events. The parsed Negril Village fixture above was not inserted into the pool. [Release response and checks](live-validation-2026-10-22.json).

The **11:50 EDT follow-up ingest** succeeded on all five Posh discovery pages after deployment of the explicit Spotz service User-Agent: 100 Posh, 53 Partiful, and 88 Luma candidates were written, with no HTTP 403 or failed sources. HTTP 207 remained appropriate because five Posh detail pages yielded no usable structured data. The pool held 421 rows. Negril Village was discovered through the live Posh feed in this run; no fixture rows were inserted.

After enforcing the published-start night boundary, the final authenticated production R&B test returned five October 22 matches and excluded the October 2–25 listing. The final build, lint, and all 409 tests passed. [Follow-up ingestion, exact response, and validation notes](posh-live-validation-2026-10-22.json).

## TikTok: permitted routes to investigate

1. **Creator-authorized Display API.** Recruit participating NYC organizers/creators and seek app approval for the intended use. OAuth-scoped profile/video access can support displaying their public videos. It is not arbitrary hashtag or city search, nor an automatic grant to build a commercial event index. [Display API](https://developers.tiktok.com/docs/en/display-api-overview).
2. **Submitted public links with official embeds.** A creator/user can supply a known video URL; oEmbed supplies attribution and display. Require an independently confirmed event listing or organizer-supplied date/location before it becomes a dated recommendation. A video upload date, geocoded venue, or caption saying “tonight” is insufficient. [TikTok embeds](https://developers.tiktok.com/docs/en/embed-videos).
3. **Licensed partnership/feed.** Evaluate contract scope, reuse rights, deletion/refresh obligations, and evidence quality before selecting a vendor. Paying for a scraper does not establish permission. No vendor has been selected or integrated.

The Research API explicitly excludes commercial users and is not this product's route. [TikTok eligibility FAQ](https://developers.tiktok.com/docs/en/research-api-faq). Caption/OCR extraction, creator OAuth, embeddings, and TikTok event corroboration are future work, not shipped capabilities.

## Next operational steps

Inspect `failedSources`/`partialSources` and observation ages after each release or ingestion. Posh's verified production run now fetches discovery pages successfully, while missing structured details remain explicit warnings and pagination remains bounded. Seek direct source/organizer agreements; add licensed calendar ingestion and cancellation webhooks before claiming comprehensive or near-real-time coverage. Messaging is described in [conversational discovery](conversational-discovery.md).
