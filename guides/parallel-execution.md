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
- The orchestrator applies the **Merge Decision Table** (see below). Each file pattern has an explicit rule — there is no silent "pick a winner" fallback.
- If the rule says ABORT, it stops and asks you to resolve manually
- If the file is in the Shared Resource Registry, the conflict should have been prevented earlier by Phase 2.5 (Arbitrated Merge). If you see one anyway, the `touches:` manifest was wrong — check the worker reports.
- You can prevent collisions by adding `depends_on` to serialize the conflicting features, or by ensuring each feature declares a complete `touches:` manifest so the orchestrator can auto-serialize via Rule 7.

### "Layer split produced incompatible code"

The contract was probably wrong. Check `src/contracts/{feature-name}.ts`:
- Are the request/response shapes what you wanted?
- Are the endpoint URLs correct?
- Are types using primitive shapes (strings for dates, etc.) so both sides can work with them?

Fix the contract and either re-run the feature or fix the consumers manually.

### Watching progress

Each Feature Builder writes heartbeats to `<worktree>/.claude-progress.log`. See the **Heartbeat Contract** section below for the line format and the 5-minute stall timeout.

## Shared Resource Registry

Some files cannot be safely modified by two workers at once — editing them in parallel guarantees a merge conflict or silent data loss. The orchestrator maintains a **Shared Resource Registry** of these files and serializes any feature that touches one.

The default registry is:

- `src/lib/utils.ts` and any `src/lib/*.ts` utility modules
- `prisma/schema.prisma`
- `src/db/schema.ts`
- `package.json`
- `tsconfig.json`
- `.env`, `.env.local`, `.env.example`
- `next.config.js` / `vite.config.ts` / `drizzle.config.ts`
- `middleware.ts` (Next.js global middleware)
- `src/app/layout.tsx` (Next.js root layout)
- `src/app/providers.tsx` (React context providers)
- `src/i18n/*.json` (translation catalogs)

### Extending the registry per-project

If your project has its own shared files — a `src/theme/tokens.ts`, a `routes.config.ts`, an OpenAPI generator output — list them under a top-level `shared_resources:` array in the blueprint:

```yaml
shared_resources:
  - src/theme/tokens.ts
  - src/routes.config.ts
```

The orchestrator treats the union of the default list and the blueprint extension as the active registry. It prints the active registry at the start of Phase 0 so you can verify it before the build begins.

## The `touches:` Manifest

Every Feature Builder declares a `touches:` manifest at kickoff, listing the files it intends to create or modify. The orchestrator validates each new manifest against every already-running worker's manifest. If two workers would touch the same file — or two files that fall under the same registry entry — the orchestrator either serializes them or rejects the later one.

Format, declared before any file is written:

```yaml
touches:
  create:
    - src/app/api/todos/route.ts
  modify:
    - prisma/schema.prisma
    - src/lib/date.ts
```

### Worked example: two features want `src/lib/date.ts`

Suppose your blueprint has:

```yaml
features:
  - name: todo-list
    skills: [react-component, react-hooks]
    touches:
      modify: [src/lib/date.ts]
  - name: calendar-view
    skills: [react-component, routing]
    touches:
      modify: [src/lib/date.ts]
```

Both features want to add a helper to `src/lib/date.ts`, which is in the default Shared Resource Registry (`src/lib/*.ts`). Without coordination they would produce a conflicting pair of edits.

The orchestrator handles this by applying **Rule 7 — Shared resource collision**: the later-declared feature (`calendar-view`) gains an implicit dependency on `todo-list`. They end up in consecutive waves instead of the same wave. `todo-list` writes its helper, merges to `main`, and only then does `calendar-view` start — so it sees the up-to-date `date.ts` and can rebase its edit cleanly.

If that serialization would push the dependent wave over the 4-agent cap, the orchestrator instead keeps both features in the same wave and routes their edits through the Shared Resource Arbitrator in Phase 2.5.

## Merge Decision Table

When the orchestrator merges a wave's branches back to `main`, it uses this exact table — not heuristics — to resolve conflicts:

| File pattern | Merge strategy |
|---|---|
| `package.json` (dependencies, devDependencies) | Union of all keys; on version conflict, take the highest semver |
| `package.json` (scripts) | Union; on key collision, ABORT and ask the user |
| `prisma/schema.prisma` | Model-level merge — each wave worker must add whole models; field-level edits on an existing model = ABORT |
| `src/db/schema.ts` (Drizzle) | Same as Prisma: table-level merge, ABORT on field-level collision |
| `src/lib/*.ts` | Must use namespaced re-exports — workers add `export * from './feature-x-utils'`; new files preferred over editing existing utils |
| `.env*` | Union; on key collision, ABORT |
| `tsconfig.json` | Must not be touched by features; only by project-initializer |
| Any other file | Prefer additive merge; on logic conflict, ABORT and ask the user |

When the table says **ABORT**, the orchestrator stops the wave merge and surfaces the conflict to you. It does not pick a winner silently. If you want to avoid aborts in practice:

- Put shared-utility additions in **new files**, not edits to existing ones. The `src/lib/*.ts` rule expects `export * from './feature-x-utils'`-style re-exports.
- Prefer **whole new models** over field edits on existing Prisma/Drizzle models.
- Do not assign features that touch `tsconfig.json` — change it manually between builds.

## Heartbeat Contract

Every parallel Feature Builder appends a heartbeat line to `{worktree}/.claude-progress.log` at least every 60 seconds and after every meaningful step. The orchestrator tails these files. If it sees no new lines for **5 minutes** on any worker, it considers that worker stalled and terminates it.

### Line format

```
{ISO-8601 timestamp} [{stage}] {human-readable message}
```

`stage` is one of: `kickoff`, `reading-skills`, `reading-project`, `writing-files`, `running-tests`, `debugging`, `committing`, `reporting`.

Example:

```
2026-04-11T14:32:07Z [kickoff] touches manifest declared, awaiting orchestrator approval
2026-04-11T14:33:02Z [writing-files] created src/components/TodoList.tsx
2026-04-11T14:34:20Z [running-tests] npm test started
2026-04-11T14:34:48Z [running-tests] 14 passed, 0 failed
```

### Tailing a live worker

```bash
tail -f /path/to/worktree/.claude-progress.log
```

If a worker is taking longer than you expect but is still emitting heartbeats, it's making progress — leave it alone. If the log has been silent for minutes, the orchestrator will handle termination; you don't need to intervene.

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
