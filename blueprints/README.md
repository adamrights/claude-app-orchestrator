# Blueprints

Blueprints are YAML files that declaratively describe an app to be built. The orchestrator agent reads a blueprint, picks a template, scaffolds the project, and dispatches specialist agents to build each feature.

## Files

- [schema.md](schema.md) — Field reference for the blueprint format
- `examples/` — Example blueprints, one per template variant
  - [todo-app.yaml](examples/todo-app.yaml) — Fullstack todo app (default Next.js template)
  - [dashboard-spa.yaml](examples/dashboard-spa.yaml) — Client-side dashboard SPA (Vite template)
  - [notes-api.yaml](examples/notes-api.yaml) — Standalone notes API (Hono template)
  - [saas-platform.yaml](examples/saas-platform.yaml) — Multi-tenant SaaS with RBAC, billing, jobs (v2 schema)
  - [webhook-integration.yaml](examples/webhook-integration.yaml) — Webhook relay/processor API (v2 schema)

## How to use

1. Copy an example: `cp blueprints/examples/todo-app.yaml my-app.yaml`
2. Edit it to describe your app
3. Tell Claude Code: *"Read agents/orchestrator.md and build my-app.yaml into ./my-app/"*

The orchestrator infers the template from the `stack.type` field unless you set `template:` explicitly. See [schema.md](schema.md) for all available fields.
