# Agents

## Orchestration

- [Orchestrator](orchestrator.md) — Master agent that builds a complete app from a blueprint, with optional parallel execution
- [Project Initializer](project-initializer.md) — Scaffolds a new project from a template (Phase 1 specialist)
- [Feature Builder](feature-builder.md) — Worker agent that builds a single feature in an isolated worktree (used by parallel waves)
- [Contract Designer](contract-designer.md) — Defines a typed API contract so frontend + backend can build in parallel
- [Shared Resource Arbitrator](shared-resource-arbitrator.md) — Serializes writes to shared files (package.json, prisma schema, env) when parallel workers collide
- [Migration Specialist](migration-specialist.md) — Generates and names database migrations after schema-mutating waves
- [Contract Validator](contract-validator.md) — Validates contract completeness before dispatching parallel layer-split builders

## Feature Specialists

- [React Feature Builder](react-feature-builder.md) — Scaffolds complete React features with tests
- [API Endpoint Builder](api-endpoint-builder.md) — Creates validated API endpoints with DB integration
- [Fullstack Debugger](fullstack-debugger.md) — Traces and fixes bugs across frontend/backend layers
- [Code Reviewer](code-reviewer.md) — Reviews for correctness, performance, a11y, and security

## Advanced React Specialists

- [RSC Architect](rsc-architect.md) — Designs `'use client'` boundaries, Server Actions, and streaming Suspense for Next.js App Router
- [Design System Builder](design-system-builder.md) — Scaffolds Radix + Tailwind + CVA primitives (Button, Dialog, Form, etc.) with `forwardRef` and accessibility baked in
- [React Performance Auditor](react-performance-auditor.md) — Audits an existing React app for LCP/INP/CLS, bundle, hydration, and rendering issues; produces a prioritized fix list

## Domain Specialists (v2)

- [Integration Specialist](integration-specialist.md) — Wires up third-party SDKs (Stripe, Resend, S3) from blueprint integration entries
- [Background Jobs Specialist](background-jobs-specialist.md) — Implements cron and queue-driven background jobs
- [RBAC Specialist](rbac-specialist.md) — Generates permissions, role hierarchies, and authorization middleware

## Data-Heavy App Specialists

- [Data Table Builder](data-table-builder.md) — Searchable/sortable/paginated tables with URL state
- [Dashboard Builder](dashboard-builder.md) — Metric cards, charts, date-range dashboards
- [Admin Panel Builder](admin-panel-builder.md) — Admin CRUD views with RBAC, bulk actions
