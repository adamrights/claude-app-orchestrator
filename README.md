# claude-app-orchestrator

A knowledge base + app builder for fullstack web development with [Claude Code](https://claude.com/claude-code). You write a declarative blueprint describing the app you want, and Claude agents build it — scaffolding the project, designing the schema, implementing features, writing tests, and committing each step. With optional parallel execution across independent features.

The default stack is **Next.js + Prisma + Tailwind**, but additional templates are included for client-side SPAs and standalone APIs.

## What's in the box

- **`skills/`** — Coding guidelines that agents follow when writing code (React patterns, hooks, state management, API design, database, testing, etc.)
- **`agents/`** — Agent definitions for the orchestrator, per-feature worker, contract designer, orchestration support (contract validator, shared-resource arbitrator, migration specialist), feature specialists (React, API, debugger, code reviewer), and domain specialists (integration, background jobs, RBAC)
- **`blueprints/`** — Declarative app specs (YAML) and worked examples for fullstack, SPA, and API projects
- **`templates/`** — Starter file trees for each app type, including a project-level `CLAUDE.md` that teaches Claude how to work in the new project
- **`guides/`** — User-facing docs covering blueprint authoring, orchestrator usage, parallel execution, and how to extend the system

## Quick start

```bash
git clone <this-repo> && cd claude-app-orchestrator
./install.sh                 # symlinks 4 slash commands into ~/.claude/commands/
```

Then in Claude Code, from any directory:

```
/orchestrate examples/built/helpdesk/blueprint.yaml ~/helpdesk
```

That builds the [helpdesk reference app](examples/built/helpdesk/) — a B2B support ticketing system that exercises ~17 skills and most specialists. To build your own app:

1. Copy a blueprint example: `cp blueprints/examples/todo-app.yaml ~/my-app.yaml`
2. Edit it to describe your app
3. `/validate ~/my-app.yaml` (catches typos before the build runs)
4. `/orchestrate ~/my-app.yaml ~/my-app`

Slash commands at a glance:

| Command | What it does |
|---------|--------------|
| `/orchestrate <blueprint> [out]` | Validate, scaffold, and build an app |
| `/validate <blueprint>` | Pre-flight a blueprint without building |
| `/audit` | Run the React Performance Auditor in the cwd app |
| `/extend "<description>"` | Add a new feature to an already-built app |

Without slash commands, see [`CHEATSHEET.md`](CHEATSHEET.md) for the manual incantations.

The orchestrator picks the right template based on the blueprint's `stack`, scaffolds the project, then dispatches specialist agents (with the relevant skills loaded) to build each feature. Each feature becomes its own git commit so you can review the work incrementally. A `BUILD_REPORT.md` lands in the output directory describing what was built and what to do next.

## How it works

```
blueprint.yaml ──► Orchestrator ──► Templates  ──► Scaffolded project
                       │                                 │
                       ├── Phase 0: Compute waves        │
                       ├── Phase 1: Scaffold ────────────┘
                       ├── Phase 2: Build features
                       │     ├── Wave 0: [auth]
                       │     ├── Wave 1: [api, ui*]      ← parallel worktrees
                       │     └── Wave 2: [tests]
                       └── Phase 3: Integration & review
```

The orchestrator infers dependencies between features (auth, model overlap, page overlap, test→impl) and groups them into **waves**. Features in the same wave run in parallel inside isolated git worktrees, then merge back to `main`. For features that touch both frontend and backend, a **layer-level split** writes a typed contract first so the API and UI can build simultaneously.

See [`guides/parallel-execution.md`](guides/parallel-execution.md) for the full details.

## Templates

| Template | App type | Stack |
|----------|----------|-------|
| `nextjs-prisma-tailwind` (default) | Fullstack web app | Next.js App Router + Prisma + PostgreSQL + Tailwind + NextAuth |
| `vite-react-tailwind` | Client-side SPA | Vite + React + TanStack Query + Tailwind + React Router |
| `hono-api` | Standalone API backend | Hono + Drizzle + PostgreSQL + Zod (Node, Bun, or edge) |

The template is inferred from the blueprint's `stack.type` (`fullstack`, `spa`, or `api`), or set explicitly with a `template:` field.

## Blueprint at a glance

```yaml
name: todo-app
description: Simple todo list with GitHub OAuth

stack:
  type: fullstack
  database: postgres
  auth: github

execution: auto   # parallel when safe, sequential otherwise

models:
  Todo:
    fields:
      id: cuid
      title: string
      completed: boolean @default(false)
      author: User @relation
      createdAt: datetime @default(now())

pages:
  - path: /dashboard
    auth: true
    features: [list, add, delete]

features:
  - name: auth
    description: GitHub OAuth login/logout
    skills: [authentication, react-hooks]

  - name: todo-crud-api
    description: CRUD endpoints for todos
    skills: [api-design, database]
    depends_on: [auth]

  - name: todo-list-ui
    description: Dashboard page with add/toggle/delete
    skills: [react-component, react-hooks, state-management, styling]
    depends_on: [todo-crud-api]

  - name: tests
    description: Component and integration tests
    skills: [react-testing]
```

Full schema: [`blueprints/schema.md`](blueprints/schema.md)

## Documentation

- [`guides/orchestrator-usage.md`](guides/orchestrator-usage.md) — End-to-end workflow
- [`guides/blueprint-authoring.md`](guides/blueprint-authoring.md) — Writing good blueprints
- [`guides/parallel-execution.md`](guides/parallel-execution.md) — How parallel mode works
- [`guides/adding-templates.md`](guides/adding-templates.md) — Adding a new starter template
- [`guides/adding-skills.md`](guides/adding-skills.md) — Extending the knowledge base

## Extending the system

- **Add a skill**: Drop a markdown file under `skills/{category}/`, add it to the orchestrator's skill mapping table, and reference it from blueprint features.
- **Add a template**: Create `templates/{name}/scaffold.yaml` and a `files/` tree with starter files including a project-level `CLAUDE.md`.
- **Add an agent**: Create `agents/{name}.md` with YAML frontmatter (`name`, `description`, `tools`) and a workflow section.

See the guides for step-by-step instructions.

## Status

Early-stage. The orchestrator's behavior is described declaratively in `agents/orchestrator.md` — Claude Code reads it and executes the workflow. There is no separate CLI or runtime to install.
