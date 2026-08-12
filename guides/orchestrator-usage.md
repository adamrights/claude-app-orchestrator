# Using the Orchestrator

The orchestrator (`agents/orchestrator.md`) turns a blueprint YAML into a working app. Install once (`./install.sh`), then the whole journey is four commands:

```
/wayfind "idea"        # optional — only when the idea is still foggy (guides/wayfinding.md)
/validate my-app.yaml  # pre-flight: schema, skills, dependency cycles
/orchestrate my-app.yaml ./my-app
/resume ./my-app       # only if a build gets interrupted (guides/resuming-builds.md)
```

## What a build does

1. **Plan** — infers dependencies between features and groups them into waves; independent features build **in parallel** in isolated git worktrees when the safety checks pass, sequentially otherwise (details: [parallel-execution.md](parallel-execution.md)).
2. **Scaffold** — picks a template from `stack.type`, generates the schema from `models`, installs, commits.
3. **Build** — each feature goes to the right specialist agent with its skills loaded; tests run and each feature becomes its own commit. v2 blueprints also get integrations, shared primitives, RBAC, jobs, and webhooks phases.
4. **Review** — full test suite, code-review pass, production build, final commit.

## What lands in the output directory

- **The app**, one git commit per feature — review with `git log`, revert a feature commit and ask for a redo if something looks wrong.
- **`BUILD_REPORT.md`** — the human-facing story: what was built, how to run it, env vars still needed.
- **`.claude-build/map.yaml`** — the machine-facing Build Map: every unit's status + commit, and every decision made after the blueprint was frozen. This is what makes `/resume` and decision-consistent multi-session builds work.

## When something goes wrong

- **Blueprint is wrong mid-build** — the orchestrator stops rather than improvising; fix the blueprint (reopen the wayfinder map ticket if there is one) and re-run. Never edit the blueprint mid-build.
- **A worker hits an unsettled one-way-door decision** — it reports `blocked-on-decision` instead of guessing; you'll be asked, and the answer is recorded in the Build Map for every later worker and session.
- **Session dies** — `/resume <dir>` verifies the blueprint hash and git history, then continues from the first pending unit.

## After the build

- `/audit` (in the app dir) — React performance review.
- `/extend "feature description"` — add a feature; the app's recorded decisions are inherited, and genuinely foggy extensions reopen the wayfinder map.
