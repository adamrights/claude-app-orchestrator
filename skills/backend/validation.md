---
tags: [validation, zod, input-validation, schema, sanitization]
---

# Validation

## When to use
At every API boundary — route handlers, form submissions, webhook payloads, environment variables, and any data entering the system from an external source. Validate at the edge, trust internally.

## Guidelines

- **Zod is the standard validation library.** It provides TypeScript-first schema declaration with automatic type inference.
- **Validate at the boundary, trust internally.** Parse input once at the API handler or middleware level. Once validated, pass the typed data through business logic without re-validating.
- **Use `safeParse`, not `parse`, in API handlers.** `parse` throws on failure. `safeParse` returns a result object you can use to send a structured error response.
- **Compose schemas for reuse.** Use `.pick()`, `.omit()`, `.partial()`, `.extend()`, and `.merge()` to derive schemas from base definitions rather than duplicating fields.
- **Coerce query parameters.** Query params arrive as strings. Use `z.coerce.number()`, `z.coerce.boolean()` for type conversion.
- **Sanitize strings.** Trim whitespace with `.trim()`, normalize emails with `.toLowerCase()`, limit lengths with `.max()`. Strip HTML where user input might contain markup.
- **Format errors for the client.** Use `error.flatten()` or `error.format()` to produce a field-level error map the frontend can consume.
- **Never trust client input, even from authenticated users.** Authorization does not imply data integrity.
- **Validate environment variables at startup.** Use a Zod schema to parse `process.env` in a dedicated `env.ts` module. Fail fast if required vars are missing.

## API Route with Zod Validation

```tsx
import { z } from 'zod';
import { NextResponse } from 'next/server';

const CreateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  role: z.enum(['admin', 'member']).default('member'),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = CreateUserSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await db.user.create({ data: result.data });
  return NextResponse.json({ data: user }, { status: 201 });
}
```

## Pagination Schema

```tsx
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Usage in a GET handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = PaginationSchema.safeParse(Object.fromEntries(searchParams));

  if (!params.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, sort, order } = params.data;
  const posts = await db.post.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sort]: order },
  });

  return NextResponse.json({ data: posts, meta: { page, limit } });
}
```

## Reusable Schema Composition

```tsx
// Base schema
const UserBase = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'member']),
  bio: z.string().max(500).optional(),
});

// Derive variants
const CreateUserSchema = UserBase.omit({ role: true }); // role set server-side
const UpdateUserSchema = UserBase.partial();             // all fields optional
const UserResponseSchema = UserBase.extend({             // add computed fields
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
});
```

## Environment Variable Validation

```tsx
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);
```

## Checklist
- [ ] All API endpoints validate input with Zod before processing
- [ ] `safeParse` is used (not `parse`) in API handlers
- [ ] Error responses include field-level error details
- [ ] Query parameters are coerced to proper types
- [ ] Strings are trimmed and normalized
- [ ] Environment variables are validated at startup with a Zod schema
- [ ] Schemas are composed from base definitions, not duplicated
