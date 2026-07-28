# AGENTS.md — `src/test/quality`

## Purpose

Deterministic quality evals for the generation pipeline. Programmatic grader,
no model in the loop, so the numbers are stable enough to gate a build.

## Ownership

- The grader: `grade.ts` — runs curate → partition → assemble → repair → audit
  over each fixture pool and reports metrics.
- The gate: `plan-quality.test.ts` — measured baselines plus ratchet assertions.
- The corpus: `../fixtures/research/*.json` — real research pools captured from
  live generations, imported by an explicit registry in `grade.ts`.

## Local Contracts

- **Baselines are measured, never chosen.** Run the suite, read the printed
  table, write those numbers down. A baseline picked by intuition is worse than
  no baseline: it fails on noise and passes on regressions.
- **Assertions are ratchets, not equalities.** Better than baseline passes.
  When an improvement turns them green, bump the numbers in the same commit —
  the diff is the evidence the change did something.
- **The grade must not be gameable by deleting content.** The audit's ceiling is
  a *min over findings*, so it rises when the plan holds less. `scheduledItems`
  and `emptyBuckets` are pinned for exactly that reason; don't remove them to
  make a red build green.
- **Coverage is pinned alongside quality.** Every geographic check no-ops
  without coordinates and the hours check no-ops without hours, so *losing*
  input data makes the score go UP. `new-york-city-unlocated` scores a flawless
  100 purely because it is blind. `located` and `withHours` baselines are what
  stop a blindness regression from reading as a win.
- Day assembly uses `buildFallbackDay`, not the LLM planner, on purpose: the
  grade measures everything downstream of the model rather than today's
  sampling luck. Putting a model in this loop would make it non-deterministic
  and unfit to gate a build.

## What this does NOT measure

Whether an itinerary is any *good* — interesting, on-theme, well-paced. A plan
can grade a clean 100 and still be four days of tourist-trap sludge in the right
order. That needs an LLM judge or a human and belongs in a separate suite.

Nor does it catch live-integration breakage: the fixtures are static, so a
Google Places outage or an auth failure in production is invisible here. This
guards the logic, not the vendor.

## Adding a pool

Drop the `result` object from a `.cache/research/*.json` entry into
`../fixtures/research/`, register it in `POOLS`, run the suite, and record the
printed row as its baseline. The registry is explicit so it is obvious what is
being measured.

## Verification

- `npx vitest run src/test/quality` — prints the table, then asserts.
- To confirm the gate still bites, break something on purpose (make the refill
  hours-blind, or stop refilling after a drop) and check it goes red. Both of
  those were real bugs; both are caught.
