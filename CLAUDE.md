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

- `main` is production. Vercel deploys it. It only changes through a release PR from `develop`.
- `develop` is where all work goes. Commit and push straight to it. No feature branches, no PRs.

The loop:
1. `git checkout develop && git pull --rebase`: sync before anything
2. Commit on `develop`
3. `git pull --rebase && git push`

Releasing to prod: open a PR `develop` → `main` and merge it with "Create a merge commit" (not squash). Then apply any new Supabase migrations to prod.

Rules:
- Keep commits small and self-contained, one logical change each.
- Never commit to `main` directly.
- Supabase migrations ride with their code. Apply them to prod when the release PR merges, not before.
