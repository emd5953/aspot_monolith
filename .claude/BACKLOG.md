# aSpot Autonomous Build Backlog

The autonomous build loop works through this list top to bottom. It picks the
first unchecked `[ ]` task, implements it on a feature branch, runs lint + tests
+ typecheck + build, commits, then checks it off here. Edit freely — reorder,
add, or remove tasks. One task = one self-contained, shippable unit of work.

## Tasks

- [ ] Google Places verification: before candidates reach the planner, confirm
      each named place against a real Places address; drop anything that can't
      be verified. Add a feature flag so it can be turned off. Test the filter.
- [ ] Carry provenance through every pipeline step: extend the schemas so each
      ScheduledItem keeps its source (`tavily` / `reddit` / `places`) and the
      "why I picked this" reason, and surface it in the itinerary view.
- [ ] AI-driven orchestrator decisions: replace the rule-based
      `decideNextAction` in agentic-orchestrator.ts with an LLM call that
      reasons over current score + issues and returns
      continue/stop/research_more/revise. Keep the rule-based path as fallback.
- [ ] Date-aware events: when trip dates fall in a window, add an events search
      (Eventbrite/Resy/Ticketmaster style) and let the planner slot a
      date-specific event when it's the obvious right answer.

## Done

- [x] Reddit-targeted research: Reddit-biased Tavily query pass merged into the
      candidate pool, candidates tagged with a `redditMentions` provenance
      count, query builder + mention-counter unit-tested. — `9a604db`
