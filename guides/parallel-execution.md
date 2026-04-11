# Parallel Execution

The orchestrator can build multiple features in parallel using isolated git worktrees. This guide explains when parallel mode triggers, how dependencies are inferred, and how to debug things when they go wrong.

## When parallel mode runs

The blueprint's top-level `execution` field controls this:

- `execution: auto` (default) — Run inference, then run in parallel if the safety checks pass
- `execution: parallel` — Always run in parallel, skip safety checks
- `execution: sequential` — Always run one feature at a time

In `auto` mode, the orchestrator runs in parallel only if **all** of these are true:
- Total features ≤ 20
- No wave contains more than 4 features
- The dependency graph is acyclic
- At least one wave has 2+ features (otherwise sequential is just as fast)
- The blueprint includes a test feature

If any check fails, it falls back to sequential and tells you why.

## How dependencies are inferred

The orchestrator looks at every pair of features and asks "does B depend on A?" using these rules:

1. **Explicit `depends_on`** — Authoritative. Always wins.
2. **Auth dependency** — Features that touch authenticated pages depend on the auth feature
3. **Model overlap** — Two features that mention the same model name depend on each other in declaration order
4. **Page overlap** — Two features that build the same page path depend in declaration order
5. **Test → impl** — Test features automatically depend on every prior non-test feature
6. **Schema migration order** — Features that touch `models` depend on each other in declaration order (prevents schema race conditions)

After inference, features are grouped into **waves**. Wave 0 is everything with no dependencies; Wave N is everything whose dependencies are all in waves `< N`.

## Layer-level parallelism

A feature is **splittable** when its `skills` array contains BOTH:
- A frontend skill (`react-component`, `react-hooks`, `state-management`, `routing`, `styling`)
- A backend skill (`api-design`, `database`)

For splittable features, the orchestrator runs three sub-phases inside one wave slot:

1. **Contract Designer** writes a typed API contract at `src/contracts/{feature-name}.ts`
2. **Frontend builder** and **backend builder** run in parallel worktrees, both reading the contract
3. **Integration** merges both worktrees and runs end-to-end tests

This is the highest-throughput mode but it requires that the contract is right. If the contract is wrong, both halves end up incompatible — fix the contract first, then rebuild.

## How worktrees work

When a wave has 2+ features, the orchestrator spawns each as a background sub-agent with `isolation: "worktree"`. That gives each agent:

- Its own checkout in a separate directory
- Its own branch (named after the feature)
- Full read/write access to that directory only

Each agent commits to its branch. After all wave agents complete, the orchestrator merges branches back to `main` one at a time, runs tests, and resolves any conflicts.

Worktrees are cleaned up automatically when an agent finishes — but you can list any leftover ones with:

```bash
git worktree list
git worktree remove <path>
```

## Debugging

### "Falling back to sequential because…"

The orchestrator prints why a safety check failed. Common causes and fixes:

- **Too many features (> 20)**: Split your blueprint into smaller chunks
- **Wave too large (> 4 features)**: Add `depends_on` to serialize some features
- **Cycle detected**: Look at the cycle members and fix the `depends_on` chain
- **No test feature**: Add a `tests` feature so the orchestrator has a way to verify parallel work

### "Worker agent reported failure"

Each Feature Builder reports a structured result. If it failed:
- **Test failures**: The Fullstack Debugger workflow runs automatically; if it can't fix the issue, you'll see the error
- **Skill not found**: Check the skill name in the feature's `skills` array against the orchestrator's mapping table
- **Contract mismatch (layer split)**: The Contract Designer probably picked the wrong shape — look at `src/contracts/{name}.ts`, fix it, and re-run that feature
- **File outside worktree**: A bug in the worker — file an issue or re-run

### "Merge conflict during wave merge"

If two parallel agents touched the same file:
- The orchestrator tries additive resolutions first
- If that fails, it stops and asks you to resolve manually
- You can prevent this by adding `depends_on` to serialize the conflicting features

### "Layer split produced incompatible code"

The contract was probably wrong. Check `src/contracts/{feature-name}.ts`:
- Are the request/response shapes what you wanted?
- Are the endpoint URLs correct?
- Are types using primitive shapes (strings for dates, etc.) so both sides can work with them?

Fix the contract and either re-run the feature or fix the consumers manually.

### Watching progress

Each Feature Builder writes progress to `<worktree>/.claude-progress.log`. If an agent seems stuck, you can tail this file:

```bash
tail -f /path/to/worktree/.claude-progress.log
```

## When to force a mode

**Force `parallel`** when:
- You're confident the dependency graph is correct
- You've tested the blueprint before and want maximum speed
- Safety checks are tripping on something you don't care about (e.g., no test feature)

**Force `sequential`** when:
- You're debugging a build issue and want predictable behavior
- The blueprint touches files in ways the inference can't see
- You don't trust the merge conflict resolution

## Performance tips

- **Order features by independence** — Put unrelated features first so they end up in early waves
- **Use small features** — A 5-feature wave with simple features beats a 1-feature wave with one massive feature
- **Group tests at the end** — One `tests` feature with all coverage is fine; the orchestrator will put it in its own wave anyway
- **Avoid splittable features for simple CRUD** — The contract overhead isn't worth it for trivial endpoints. Mark such features with only backend OR only frontend skills to skip the split.
