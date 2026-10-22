# AGENTS.md — `src/lib/discovery`

## Purpose

Transport-independent conversational discovery of sourced NYC events for one night.

## Ownership

- `conversation.ts` parses the supported message vocabulary, carries explicit preferences across user turns, ranks shared pool rows, and renders factual responses.
- `@/lib/ai/schemas/discovery` owns request/result schemas. `@/lib/sources` owns source evidence and pool eligibility. `@/lib/time/nyc` owns local dates.

## Local Contracts

- No provider transport, outbound messages, live source fetching, or model-generated event facts. The authenticated HTTP route is the first adapter.
- Literal genre evidence means "the listing mentions X", never an inferred guarantee about a venue's music. Missing evidence does not establish a negative fact.
- Unknown price, availability, location, or date stays unknown. A budget filter requires known USD price or explicitly free admission. Sold-out, cancelled, stale, and undated listings are not recommended. An event's published start must fall within the requested night window; a long date range that began on another night is insufficient.
- Conversation state is reconstructed from bounded user messages; assistant text cannot supply facts. Unsupported or ambiguous dates/preferences elicit clarification.
- At 00:00–05:59 Eastern, tonight refers to the preceding nightlife date. Display after-midnight events with their calendar day and time zone.

## Work Guidance

- Keep parsing deterministic and its supported scope explicit. Broader natural-language parsing can replace this seam with schema-validated intent, without authoring recommendation facts.

## Verification

- `npm test -- src/lib/discovery` replays multi-turn conversations, exclusions, uncertainty, and source-backed listings with a fixed clock.

## Child DOX Index
