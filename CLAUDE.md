# aspot_monolith

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-07-17
- MCP registered: yes (user scope)
- Artifacts sync: artifacts-only
- Current repo policy: read-write

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up and synced on this machine. The agent should prefer gbrain
over Grep when the question is semantic or when you don't know the exact
identifier yet. Two indexed corpora available via the `gbrain` CLI:
- This repo's code (registered as `gstack-code-aspot-monolith` source).
- `~/.gstack/` curated memory (registered as `gstack-artifacts-enrinjr` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-artifacts-enrinjr`

Note: the PGLite engine is single-process. When a Claude Code session has the
gbrain MCP loaded, `gbrain serve` holds the database — prefer the
`mcp__gbrain__*` tools inside sessions; the bare CLI may time out on the lock.

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. The brain auto-syncs incrementally on every gstack skill start.
Run `/sync-gbrain` to force-refresh, `/sync-gbrain --full` for full reindex.

<!-- gstack-gbrain-search-guidance:end -->

## Git workflow (main = prod, develop = integration)

- `main` is production. Vercel deploys it. Only release PRs from `develop` land here.
- `develop` is where all work goes. It's the default branch, so PRs target it.
- Local `main` and `develop` mirror the remote. Never commit to them directly.

The loop:
1. `git checkout develop && git pull --rebase`: sync before anything
2. `git checkout -b feat/thing`: branch off fresh develop
3. Commit freely on the branch
4. `git pull --rebase origin develop` periodically to stay current
5. Push, open a PR into `develop`, merge via remote, never locally
6. Delete the branch, re-sync develop

Releasing to prod: open a PR `develop` → `main`, merge it, then re-sync both locally.

Rules:
- Branches stay short-lived (1–3 days). Long branches = merge pain.
- One branch = one logical change.
- Naming: `feat/`, `fix/`, `chore/` + ticket ID.
- Rebase feature branches onto develop. Don't merge develop into your branch.
- Supabase migrations ride with their code. Apply them to prod when the release PR merges, not before.
