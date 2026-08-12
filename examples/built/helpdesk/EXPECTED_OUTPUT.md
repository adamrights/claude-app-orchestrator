# Expected output

What building [`blueprint.yaml`](./blueprint.yaml) into `./app/` produces. The `app/` subdirectory is gitignored (see `examples/built/.gitignore`) so reference builds stay source-only in version control.

**This document reflects an actual verified build** (2026-08-12, the issue #37 dogfood on the current system): 17/17 Build-Map units done, **84/84 vitest** (unit + component + a live-Postgres FTS integration suite), Playwright 5 passed + 4 `test.fixme` (signed-in flows need a test-auth strategy — OAuth-only app, see `skills/testing/e2e-testing.md`), `next build` clean, largest route 162 kB First Load JS.

## The build as a commit sequence

One commit per unit, in phase order — this is the shape `git log --oneline` should have:

```
chore: scaffold from nextjs-prisma-tailwind          Phase 1   (schema incl. NextAuth adapter models + init migration)
chore(integration): resend                           Phase 1.5 (typed client at src/integrations/resend.ts)
feat(shared): design-system                          Pre-Wave  (Radix + Tailwind + CVA primitives)
feat(rbac): roles and permissions                    Wave 0    (src/lib/permissions.ts, roles.ts, src/middleware/authorize.ts)
feat: auth — GitHub OAuth via NextAuth …                       (api-endpoint-builder's auth path)
feat: ticket-crud-api — server actions with RBAC, Zod, status FSM, SLA computation
feat: ticket-list-table — TanStack Table v8 + Query …          (data-table-builder)
feat: ticket-detail-page — RSC detail page with client islands (rsc-architect)
feat: comment-thread — optimistic replies, role-gated internal notes
feat: ticket-create — 3-step wizard with Zod validation and SLA preview
feat: ticket-search — Postgres FTS across titles, descriptions, comments
chore(db): migration for wave-6                                (tsvector columns + GIN indexes)
feat: agent-dashboard — KPI cards, status breakdown, my-queue  (dashboard-builder; server-rendered charts)
feat: email-notifications — Resend sends for assignment, replies, resolution, SLA breach
feat: user-management — admin user list with promote/demote    (admin-panel-builder)
test: Playwright e2e scaffold — auth gating live, signed-in flows gated on test-auth strategy
feat(job): sla-deadline-checker                      Phase 2.7 (Inngest v4 cron + serve route)
chore: integration fixes and cleanup                 Phase 3
```

The blueprint's `execution: sequential` is honored by the planner (`scripts/plan-waves.mjs`); see its output for the dependency reasoning.

## Top-level tree

```
app/
├── BUILD_REPORT.md            # human-facing build story (phases, decisions, how to run)
├── .claude-build/map.yaml     # machine-facing Build Map: units, commits, decisions (BD1: breach definition)
├── prisma/                    # schema (5 blueprint models + NextAuth adapter models), migrations incl. FTS, seed
├── src/
│   ├── app/                   # App Router: /tickets (+[id], +new), /agent/dashboard, /admin/users, /login, api/
│   ├── components/            # design-system primitives (ui/) + feature components
│   ├── integrations/resend.ts # typed email client — features import this, never the SDK
│   ├── jobs/                  # sla-deadline-checker (Inngest; needs inngest-cli dev or Cloud to actually fire)
│   ├── lib/                   # auth, permissions/roles, validations, ticket-state-machine, sla, search, notifications
│   └── middleware/            # authorize helpers (RBAC)
├── middleware.ts              # NextAuth route protection from pages[].auth/role
├── playwright.config.ts + tests/e2e/
└── docker-compose.yml         # local Postgres (required for dev + the FTS integration tests)
```

## Runtime prerequisites the report must state

- Postgres via `docker compose up -d postgres`; `DATABASE_URL` in `.env`
- Real `GITHUB_ID`/`GITHUB_SECRET`/`NEXTAUTH_SECRET` to sign in (build uses placeholders)
- `RESEND_API_KEY` for real email; code paths are mocked in tests
- The SLA cron fires only with `npx inngest-cli dev` (or Inngest Cloud) connected to the serve route
