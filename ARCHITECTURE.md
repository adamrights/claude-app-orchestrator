# Architecture

This repo is a prompt-native system: there is no server or CLI product. Claude Code reads markdown and executes it, with a handful of zero-dependency Node scripts where determinism matters. This document is the map of how the pieces fit — read it before restructuring anything.

## The four layers

```
 idea ──► PLAN ──────► CONTRACT ─────► EXECUTE ──────────► STATE
          /wayfind     blueprint.yaml  /orchestrate         BUILD_REPORT.md (human)
          map file     (validated)     agents + waves       .claude-build/map.yaml (machine)
             │                            │                     │
             └────────────── decision trail ────────────────────┘
                 map tickets → build_decisions → /resume → /extend
```

- **Plan** (`agents/wayfinder.md`, `skills/planning/`) — turns a foggy idea into decisions via a map of tickets; emits the blueprint. Plans, never builds.
- **Contract** (`blueprints/`) — the blueprint YAML is the system's API. Everything downstream treats it as frozen; if it's wrong mid-build, the build stops.
- **Execute** (`agents/`, `templates/`, `skills/`) — the orchestrator scaffolds a template, then dispatches workers/specialists (with skills loaded) feature-by-feature, in parallel waves when safe.
- **State** (in the output app) — `BUILD_REPORT.md` for humans; `.claude-build/map.yaml` (the Build Map) for machines: unit statuses, commit SHAs, and every decision made after the blueprint froze.

**The spine is the decision trail.** A decision is made once — in a wayfinder ticket, or mid-build via `blocked-on-decision` — recorded in exactly one home, and inherited by every later worker, session (`/resume`), and extension (`/extend`). Most of the system's design falls out of protecting this property.

## Sources of truth

| Authority | Generated from it | Sync enforced by |
|-----------|-------------------|------------------|
| `skills/manifest.yaml` | orchestrator Skill Mapping table, `skills/MAP.md`, `skills/*/README.md` | `build-skill-map.mjs --check` (CI) |
| `blueprints/schema.md` + `schema.json` + validator | — (three hand-maintained peers — known debt, see map issue #5) | validator behavior pinned by `scripts/scripts.test.mjs` |
| `agents/orchestrator.md` | — (the execution kernel) | `check-references.mjs` (paths/names only) |
| A build's Build Map (`.claude-build/map.yaml`) | — | resume protocol verifies blueprint hash + git history |
| A wayfinder map file | mirrors to GitHub issues only if opted in | the file is canonical, always |

Rule of thumb: **anything listed as generated is never edited by hand** — edit the authority, run `make skillmap`, and `make refs`/CI fails on drift.

## Execution model (who reads what, when)

1. `/orchestrate` (slash command) → validates via `scripts/validate-blueprint.mjs`, then hands off to `agents/orchestrator.md`.
2. The orchestrator computes the execution plan (Phase 0), initializes the Build Map (importing wayfinder decisions via the blueprint's `# wayfinder-map:` comment), scaffolds, then dispatches.
3. Workers get **self-contained prompts**: their feature entry, skill file paths, a pre-approved `touches:` manifest, `build_decisions`, and a worktree of the **output repo** (created manually — Agent-tool worktree isolation targets the workspace repo, not the app). They heartbeat to `.claude-progress.log`, commit excluding `.claude-build/`, and return a structured report.
4. The orchestrator merges worktrees per the Merge Decision Table, journals every boundary in the Build Map, and finalizes both reports.

## Tooling

Zero-dep Node scripts in `scripts/`, all pinned by `scripts.test.mjs` (`make test`, CI):

- `validate-blueprint.mjs` — contract enforcement (schema, skills, cycles)
- `build-skill-map.mjs` — generates everything derived from the skills manifest; `--check` = drift gate
- `check-references.mjs` — cross-reference lint (agents ↔ skills ↔ templates ↔ blueprints)

CI (`.github/workflows/ci.yml`) runs all gates on every PR and push to main. No `npm install` anywhere in the repo itself.

## Design rules that keep this coherent

1. **One decision, one home.** Never restate — gist and link.
2. **Prose for judgment, scripts for algorithms.** If a procedure has no judgment in it (validation, index generation, graph computation), it belongs in a tested script the agent runs, not in agent prose the model re-derives.
3. **Generated output is sacred** — hand edits are reverted by the next regeneration and caught by CI.
4. **Every shipped path gets executed, not just read.** Dogfood builds are the review mechanism; findings become issues; fixes cite the live failure.
5. **The blueprint freezes at build start** (hash-recorded). Changing your mind is a map/blueprint edit and a re-run, never an in-flight mutation.

## Known structural debt

Tracked on the map (issue #5): the blueprint schema's three hand-maintained authorities, and the specialist-agent roster (~20 agents, dispatch largely unmeasured — consolidation decision pending fullstack-dogfood evidence).
