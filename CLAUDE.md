# Claude Code Knowledge Base

A knowledge base + app builder for fullstack web development with Claude Code, with an emphasis on React for the frontend.

The repo gives Claude agents two things: (1) coding **skills** to follow, and (2) an **orchestrator** that turns declarative blueprints into working apps.

## Repository Structure

- `skills/` — Coding guidelines organized by domain
  - `frontend/` — React, hooks, styling, state management, routing
  - `backend/` — API design, databases, authentication
  - `devops/` — Docker, CI/CD
  - `testing/` — Unit, integration, e2e testing strategies
- `agents/` — Agent definitions
  - `orchestrator.md` — Master agent that builds apps from blueprints (with optional parallel execution)
  - `project-initializer.md` — Scaffolding specialist
  - `feature-builder.md` — Per-feature worker that runs in an isolated worktree (used by parallel waves)
  - `contract-designer.md` — Defines typed API contracts for layer-level parallel splits
  - `react-feature-builder.md`, `api-endpoint-builder.md`, `fullstack-debugger.md`, `code-reviewer.md` — Feature specialists
- `blueprints/` — Declarative app specs (YAML) and examples
- `templates/` — Starter project scaffolds referenced by blueprints
  - `nextjs-prisma-tailwind/` — Default fullstack template
  - `vite-react-tailwind/` — Client-side SPA
  - `hono-api/` — Standalone API backend
- `guides/` — User-facing documentation

## Quick Start

1. Copy a blueprint example: `cp blueprints/examples/todo-app.yaml my-app.yaml`
2. Edit the blueprint to describe your app
3. Tell Claude Code: *"Read agents/orchestrator.md and build my-app.yaml into ./my-app/"*

The orchestrator picks a template from the blueprint's `stack` declaration, scaffolds the project, then dispatches specialist agents (with relevant skills loaded) to build each feature. By default it runs features in **parallel** (in isolated worktrees) when their dependencies allow it — see [guides/parallel-execution.md](guides/parallel-execution.md).

## Conventions

- Skills are Markdown files with guidelines and code examples
- Agents are Markdown files with YAML frontmatter (name, description, tools) and a workflow section
- Blueprints are YAML files describing apps declaratively
- Templates are minimal starter file trees under `templates/{name}/files/`
- Update each directory's README when adding new files
