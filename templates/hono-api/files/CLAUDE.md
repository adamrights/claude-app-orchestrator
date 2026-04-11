# Project: {{name}}

## Tech Stack
- **Framework**: Hono 4
- **Runtime**: Node.js (also works on Bun and edge runtimes)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Drizzle ORM
- **Validation**: Zod (with `@hono/zod-validator`)
- **Testing**: Vitest

This is a **standalone API** — no UI in this project.

## Commands
- `npm run dev` — start dev server with hot reload (http://localhost:8787)
- `npm run build` — TypeScript build to `dist/`
- `npm start` — run built server
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
