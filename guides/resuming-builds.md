# Resuming builds: the Build Map

Some apps are bigger than one Claude Code session. A 20-feature blueprint can outlive a context window, a laptop battery, or your patience — and before the Build Map, an interrupted build meant archaeology: re-reading `BUILD_REPORT.md` prose, cross-checking `git log`, and hoping no decision made at hour two got silently re-decided differently at hour five.

The **Build Map** fixes both problems. It is a small machine-readable journal at `{output_dir}/.claude-build/map.yaml` that the orchestrator writes at every phase and wave boundary:

- **Units** — every piece of work (`scaffold`, each `integration:*`, each `feature:*`, each `wave-merge:*`, `review`) with a status and, once done, its commit SHA.
- **Decisions** — every question that came up *after* the blueprint was frozen, who resolved it (blueprint / orchestrator / you), and what was decided.
- **Integrity anchors** — the blueprint's SHA-256 at build start, so a resumed session refuses to continue against a blueprint that changed mid-build.

`BUILD_REPORT.md` still exists and is still the thing you read; the map is the thing the *next session* reads.

## Resuming

```
/resume ~/my-app
```

The orchestrator then:

1. Verifies the blueprint hash — a mutated blueprint stops the resume cold (restore it, or start a fresh build).
2. Cross-checks every `done` unit's commit against git history; corrupt entries go back to `pending`.
3. Reconciles units a dead session left `in-progress` (abandoned worktrees are pruned).
4. Reprints the plan with ✓/⏳/○ markers and continues from the first pending unit — with **all prior decisions intact**.

No Build Map (a build from before this feature)? `/resume` falls back to parsing `BUILD_REPORT.md` + `git log`, then creates the map so the rest of the build is journaled.

## Decisions don't get re-decided

The second job of the map is decision memory. Feature Builders classify every ambiguity they hit:

- **Two-way doors** (cheap to reverse — naming, layout choices) they settle themselves and note in their report.
- **One-way doors** (schema shape, soft vs. hard delete, auth semantics) they refuse to guess. The worker reports `blocked-on-decision` with the question, options, and a recommendation; the orchestrator answers it from the blueprint or asks you; the decision lands in the map; the worker is re-dispatched with it.

Every later worker — and every later *session* — receives the recorded decisions relevant to its work and treats them as settled. The failure mode this kills: feature 3 hard-deletes because that session guessed, feature 11 soft-deletes because that one guessed differently.

Reversing a decision is allowed but explicit: tell the orchestrator, and it records a superseding entry rather than editing history.

## FAQ

**Can I edit map.yaml by hand?** Don't, mid-build. Between sessions, the legitimate edit is deleting the file to force a from-report reconstruction — anything finer-grained, tell the orchestrator what you want instead.

**Does the map go in git?** It's written inside your app's output directory but is build tooling, not app code. The templates' `.gitignore` doesn't exclude it by default — commit it if you want build provenance in history, ignore `.claude-build/` if you don't.

**What if I changed the blueprint on purpose?** That's a new build contract. Options: restore the old blueprint and `/resume`, or accept a fresh `/orchestrate` run (the orchestrator's crash-recovery will still skip features whose commits exist and still match).
