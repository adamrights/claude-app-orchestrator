# Project: {{name}}

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library
- **Lint/Format**: ESLint (`.eslintrc.json`, via `next lint`) + Prettier
- **Git hooks**: Husky + lint-staged

## Commands
- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build (standalone output, Docker-ready)
- `npm run lint` — ESLint
- `npm run format` — Prettier write; `npm run format:check` in CI
- `npm run typecheck` — TypeScript check
- `npm test` — run tests
- `npm run db:push` — sync Prisma schema without a migration (prototyping)
- `npm run db:migrate:dev` — create + apply a named migration (preferred once models stabilize)
- `npm run db:reset` — drop, reapply migrations, re-seed (destructive)
- `npm run db:seed` — run `prisma/seed.ts`
- `npm run db:studio` — browse data in Prisma Studio

## Conventions
- Components live in `src/components/`, pages in `src/app/`
- API routes in `src/app/api/{resource}/route.ts`
- Prisma client at `src/lib/prisma.ts` — always import from there, never `new PrismaClient()` in handlers
- Validate all API input with Zod schemas at the route boundary
- Co-locate tests as `*.test.tsx` next to source files
- Use the `@/` path alias for imports from `src/`
- Tailwind for styling — no CSS Modules or styled-components

## Path Alias
- `@/components/Button` → `src/components/Button`

## Environment Variables
All env access goes through the validated module at `src/env.ts`:

```ts
import { env } from '@/env';
const url = env.DATABASE_URL; // typed, validated, non-null
```

Never read `process.env.*` directly in app code — it bypasses Zod validation
and the type system. To add a new var:
1. Add it to `.env.example` (document the expected format).
2. Add a Zod schema entry under `server` or `client` in `src/env.ts`.
3. Add it to `runtimeEnv` in the same file.

Client-visible vars must be prefixed `NEXT_PUBLIC_` and listed under `client`.
Validation runs at module-load time, so the process fails fast on startup if
anything is missing or malformed.

## Error Handling
Next.js App Router error boundaries are file-based:
- `src/app/error.tsx` — catches errors thrown while rendering a route segment.
  Client component with `reset()`.
- `src/app/global-error.tsx` — catches errors in the root layout itself.
  Must render its own `<html>` / `<body>`.
- `src/app/not-found.tsx` — 404 page.

For smaller failure boundaries (a widget, a sidebar section) wrap the subtree
with `<ErrorBoundary>` from `@/components/error-boundary`. It accepts an
optional `fallback` (node or render fn) and an `onReset` callback.

Rules of thumb:
- Throw in server components / route handlers when the request cannot be
  fulfilled. The nearest `error.tsx` catches it.
- Catch in client components when recovery is possible (retry, fallback UI).
- Always validate input with Zod before touching the DB; a ZodError surfacing
  to `error.tsx` is a bug in the route handler, not a user-facing flow.

## Database Migrations
- **Prototyping**: `npm run db:push` applies schema changes directly, no
  migration history. Fastest iteration, but no rollback path.
- **Once models stabilize**: switch to `npm run db:migrate:dev`. Prisma creates
  a timestamped migration under `prisma/migrations/` which is committed.
- **Reset**: `npm run db:reset` drops the DB, reapplies all migrations, then
  runs `prisma/seed.ts`. Useful when migration history gets tangled in dev.
- **Seed**: `prisma/seed.ts` is idempotent — safe to run repeatedly. Update it
  whenever you add demo data needed by every dev.

## Docker Dev
Local Postgres via `docker-compose up -d postgres`:
- Image: `postgres:16-alpine`, bound to `:5432`
- Data persisted in `./.pgdata/` (gitignored)
- Healthcheck waits until `pg_isready` before dependent services start
- Credentials come from `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)

The app container (built from `Dockerfile`) uses Next.js `output: 'standalone'`,
runs as non-root user `nextjs`, and starts via `node server.js`.

## Linting & Formatting
- ESLint config at `.eslintrc.json` extends `next/core-web-vitals` and adds
  no-console (warn, allows `warn`/`error`). Next 14's `next lint` reads
  eslintrc-style config only — don't convert to a flat `eslint.config.*` file
  (and keep `eslint` on v8: `eslint-config-next@14` peer-requires it).
- Prettier config in `.prettierrc` (singleQuote, trailingComma all, width 100).
- Husky runs `npm run lint && npm run typecheck` on pre-commit. Hooks install
  automatically on `npm install` via the `prepare` script. If `.husky/pre-commit`
  is missing after a fresh clone, run `npx husky init` — the scaffolder ships
  the script but filesystem permissions may strip the executable bit, so also
  run `chmod +x .husky/pre-commit` once.
- lint-staged (configured in `package.json`) runs Prettier + ESLint --fix on
  staged files for faster pre-commit feedback on large repos.

## Deployment
- Build output: `.next/standalone/` + `.next/static/` (copied into the Docker
  runner stage). `output: 'standalone'` is required for the multi-stage
  Dockerfile to produce a minimal image.
- Required env at runtime: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
  Set them via your platform's secret manager, not baked into the image.
- Run migrations before starting new instances: `npx prisma migrate deploy`.
- The container listens on `PORT=3000` as non-root user `nextjs` (uid 1001).
