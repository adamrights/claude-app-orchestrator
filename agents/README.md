# Agents

## Orchestration

- [Orchestrator](orchestrator.md) — Master agent that builds a complete app from a blueprint, with optional parallel execution
- [Project Initializer](project-initializer.md) — Scaffolds a new project from a template (Phase 1 specialist)
- [Feature Builder](feature-builder.md) — Worker agent that builds a single feature in an isolated worktree (used by parallel waves)
- [Contract Designer](contract-designer.md) — Defines a typed API contract so frontend + backend can build in parallel
- [Shared Resource Arbitrator](shared-resource-arbitrator.md) — Serializes writes to shared files (package.json, prisma schema, env) when parallel workers collide
- [Migration Specialist](migration-specialist.md) — Generates and names database migrations after schema-mutating waves

## Feature Specialists

- [React Feature Builder](react-feature-builder.md) — Scaffolds complete React features with tests
- [API Endpoint Builder](api-endpoint-builder.md) — Creates validated API endpoints with DB integration
- [Fullstack Debugger](fullstack-debugger.md) — Traces and fixes bugs across frontend/backend layers
- [Code Reviewer](code-reviewer.md) — Reviews for correctness, performance, a11y, and security
