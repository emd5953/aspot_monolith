# Conversational NYC discovery

## Working backend

`POST /api/discovery` authenticates with the existing Supabase session and reads the same event pool as itinerary generation. It returns structured recommendations plus plain text suitable for a future messaging adapter. No text messages are sent and no messaging provider is configured.

The implementation has no model dependency. The bounded, deterministic vocabulary covers R&B, hip-hop, Afrobeats, house, techno, jazz, salsa; nightlife, live music, and social events; named NYC areas; free/no cover and numeric maximum prices; tonight, today, tomorrow, weekdays, and ISO dates within two weeks. It asks for clarification for vague/unsupported follow-ups and ambiguous dates. This is a testable first conversational flow, not a general natural-language agent or an itinerary/venue-recall chatbot.

History is supplied by the caller (up to 12 messages, 1000 characters each), not persisted as a user preference profile. Only user messages set preferences. Assistant messages cannot invent source facts. Each request can replace the genre, area, night, or budget; `start over` resets them. `anywhere`, `any price`, and `any genre` clear supported constraints.

Example from a signed-in browser:

```js
const response = await fetch('/api/discovery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What’s the move for R&B tonight in NYC?' },
      { role: 'user', content: 'Brooklyn under $30' },
    ],
  }),
});
const result = await response.json();
```

Response `status` is `recommendations`, `clarification`, or `no_matches`. Recommendations expose published start/end, Eastern date/time with zone abbreviation, location, price, source-reported availability, reasons, caveats, and source links with observation times. A legitimate empty match is HTTP 200; malformed inputs are 400, oversized payloads 413, missing authentication 401, and backend failure 503. Responses are not cached.

At 1am, “tonight” refers to the preceding evening until 6am. “Today” is explicitly the current NYC calendar date. A future outing uses the requested local calendar date, regardless of UTC server date. Both repeated 1:30am times on the fall DST night are distinct instants and display EDT/EST.

Recommendation reasons quote source music evidence; they do not infer genre from an artist name. Location filters require published matching area/address text. Budget matching requires explicitly free admission or a known USD starting price; unknown currency/price is not treated as cheap. A starting-price match warns that ticket tiers and fees may cost more. Zero-price offers alone do not satisfy “no cover.” Cancelled, postponed, stale, sold-out, ended, and undated events are excluded by shared eligibility. A no-match reply describes limited pool coverage rather than asserting that NYC has no events.

## Messaging evaluation — researched 2026-10-22

| Channel                     | Fit                                                                                | Required work                                                                                                                                      | Status                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Authenticated web/HTTP      | Immediate test surface, structured results, existing identity                      | A UI can consume the endpoint                                                                                                                      | Backend implemented and tested; no new chat UI                   |
| SMS/MMS through Twilio      | Phone-number texting across iPhone and Android; direct inbound webhook integration | Sender setup, US registration, signed webhook validation, consent/opt-out handling, idempotency, private conversation storage, delivery monitoring | Recommended first external pilot; not implemented or purchased   |
| WhatsApp Business           | Rich messaging with an official API; users must use WhatsApp                       | Sender onboarding, webhook security, opt-in; templates outside the service window                                                                  | Alternative; not implemented                                     |
| Apple Messages for Business | Native Apple Messages channel for a reviewed business experience                   | Approved Messaging Service Provider (MSP), Apple business account/test account, experience design and review                                       | Investigate with an MSP after the backend pilot; not implemented |

Twilio documents inbound webhook parameters and request signature validation; US application-to-person traffic requires the applicable sender registration. Use the provider SDK's signature verification against the exact external URL and request body, then deduplicate provider message ids before processing. [Incoming webhook](https://www.twilio.com/docs/messaging/guides/webhook-request), [webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security), [US A2P registration](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).

WhatsApp allows free-form replies in the 24-hour customer service window after a user message; approved templates are required to initiate messages outside that window. [Twilio's WhatsApp concepts](https://www.twilio.com/docs/whatsapp/key-concepts).

Apple documents choosing an approved MSP, registering a test account, and submitting the experience for review before commercial launch. Its design requirements include automation disclosure and live-agent access. This is a business onboarding path, not a generic consumer iMessage bot API. [Apple Messages for Business](https://register.apple.com/resources/messages/messaging-documentation/).

Keep the discovery service independent of the channel. The next adapter should authenticate provider webhooks, map a verified sender to private short-lived conversation state, call the shared service, and render concise replies with source links. The current Supabase-session HTTP endpoint must not simply be exposed as an unauthenticated provider webhook.

## Validation and rollout

- Run `npm test -- src/lib/discovery src/lib/sources src/app/api/discovery src/app/api/ingest` for fixture replay and HTTP/ingest boundary tests. The full suite, lint, and production build are also required for backend changes.
- Apply `supabase/migrations/021_event_details.sql` before deploying this code. Existing rows need a fresh ingest to gain music/status evidence. Expired source observations do not become recommendations merely because a user asks again.
- Inspect real ingestion coverage before judging recommendation recall. Posh's follow-up production ingest fetched 100 events across five pages; five detail pages lacked usable structured data. Broad NYC or genre coverage is not established.
- The initial 2026-10-22 production test of “What’s the move for R&B tonight in NYC?” returned HTTP 200, `Cache-Control: no-store`, and `no_matches` while Posh was blocked. The 11:50 EDT refresh added 100 live Posh candidates, enabling source-backed R&B recommendations. A regression fixture excludes the October 2–25 VELVET NIGHTS listing from the October 22 request because its published start is outside the night window. Unauthenticated discovery returns 401 and temporary verification users are deleted. See [the initial recorded response](live-validation-2026-10-22.json).
- The final deployed follow-up returned five October 22 R&B recommendations, with the long-range listing excluded. [Exact live response and verification](posh-live-validation-2026-10-22.json).
- A future general intent parser may use schema-validated model output while preserving deterministic facts, exclusions, and explanations. Creator/organizer feeds, live ticket rechecks, persistent conversation storage, and external messaging adapters remain future work.
