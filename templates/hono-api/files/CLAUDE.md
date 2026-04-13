# Project: {{name}}

## Tech Stack
- **Framework**: Hono 4
- **Runtime**: Node.js (also works on Bun and edge runtimes)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Drizzle ORM
- **Validation**: Zod (with `@hono/zod-validator`)
- **Testing**: Vitest
- **Lint/Format**: ESLint (flat config) + Prettier
- **Git hooks**: Husky + lint-staged

This is a **standalone API** — no UI in this project.

## Commands
- `npm run dev` — start dev server with hot reload (http://localhost:8787)
- `npm run build` — TypeScript build to `dist/`
- `npm start` — run built server
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run typecheck` — TypeScript check
- `npm test` — run tests
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:push` — push schema to database

## Conventions
- Routes live in `src/routes/{resource}.ts`, mounted in `src/index.ts`
- Database client at `src/db/client.ts` — always import from there
- Schema definitions in `src/db/schema.ts`
- Validate all input with Zod via `@hono/zod-validator`
- Return JSON responses with appropriate HTTP status codes
- Use the `@/` path alias for imports from `src/`

## Path Alias
- `@/db/client` → `src/db/client`

## Environment Variables
All env access goes through `src/env.ts`, which parses `process.env` with a
Zod schema on module load. If any required var is missing or malformed, the
process exits with a clear error **before** the HTTP server binds.

```ts
import { env } from '@/env';
const port = env.PORT; // number, validated, defaulted
```

Never read `process.env.*` directly in app code. To add a new var:
1. Add it to `.env.example`.
2. Add a field to `EnvSchema` in `src/env.ts`.
3. Read it as `env.YOUR_VAR`.

## Error Handling
Global error middleware lives in `src/middleware/error-handler.ts` and is
attached via `app.onError(errorHandler)` in `src/index.ts`. It catches
anything thrown from a route handler and returns a structured JSON envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "..." } }
```

Distinguishes three cases:
- **`ZodError`** → HTTP 400, includes flattened `details`. Normally raised
  automatically by `@hono/zod-validator`.
- **`HTTPException`** (from `hono/http-exception`) → uses its own status and
  message. Throw this when you want to short-circuit with a specific code:
  `throw new HTTPException(404, { message: 'Post not found' })`.
- **Everything else** → HTTP 500. In production the message is sanitized to
  `'Internal server error'`; in dev the real message is returned to speed
  debugging.

Handlers should throw, not catch-and-return — let the middleware do the
envelope shaping. The only exception is when you have a domain-specific
recovery path.

## Logging
Structured JSON logs via `src/lib/logger.ts`. Every log line includes
`level`, `time`, `msg`, plus arbitrary fields. The interface mirrors `pino`,
so swapping the stub for real pino is a one-line change.

Request logging middleware (`src/middleware/logger.ts`) emits one line per
request with `{requestId, method, path, status, durationMs}`. It runs after
`requestId` middleware so every log line carries the same correlation id
(also echoed back as the `x-request-id` response header — clients should
send that id when opening a support ticket).

Set `LOG_LEVEL` env var to `debug` / `info` / `warn` / `error`.

## Database Health
`GET /health` runs `SELECT 1` against Postgres via Drizzle:
- 200 `{status: 'ok', db: 'up'}` when the query succeeds
- 503 `{status: 'degraded', db: 'down'}` when it throws

Load balancers / orchestrators should treat non-200 as "remove from rotation".
Do not add business-logic checks here — keep it cheap so it can be polled
aggressively.

## Docker Dev
`docker-compose up` brings up:
- `postgres` — `postgres:16-alpine` with healthcheck, data in `./.pgdata/`
- `app` — built from `Dockerfile`, waits on postgres health, reads env from
  compose

Build image alone:
```sh
docker build -t {{name}} .
```

The runner stage installs only prod deps (`npm ci --omit=dev`) and runs as
non-root user `hono` (uid 1001).

## Deployment
- Build output: `dist/index.js` (plus sibling files from `tsc`). Entry point
  is `node dist/index.js`.
- Runtime: `node:20-alpine`, non-root user, minimal image (~80MB).
- Required env at runtime: `DATABASE_URL`, `PORT` (default 8787),
  `NODE_ENV=production`, optional `LOG_LEVEL`.
- Run `npm run db:generate` locally and check migrations into git; in the
  deploy pipeline run `npm run db:push` (or `drizzle-kit migrate` in prod)
  before starting new instances.
- Health check endpoint for orchestrators: `GET /health`.

## Adding a Route

```ts
// src/routes/posts.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/db/client';

export const posts = new Hono();

const CreatePost = z.object({ title: z.string().min(1) });

posts.post('/', zValidator('json', CreatePost), async (c) => {
  const data = c.req.valid('json');
  // ... use db
  return c.json({ data }, 201);
});
```

Then mount it in `src/index.ts`:
```ts
import { posts } from './routes/posts';
app.route('/posts', posts);
```
