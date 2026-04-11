# API Design

## When to use
When creating REST or GraphQL APIs for a fullstack application.

## REST API Conventions

- Use plural nouns for resources: `/api/users`, `/api/posts`.
- HTTP methods map to CRUD: GET (read), POST (create), PUT/PATCH (update), DELETE (delete).
- Return appropriate status codes: 200 (ok), 201 (created), 400 (bad request), 404 (not found), 500 (server error).
- Use consistent response envelopes:

```json
{
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "total": 42 }
}
```

## Next.js API Routes (App Router)

```tsx
// app/api/posts/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? 1);
  const posts = await db.post.findMany({ skip: (page - 1) * 20, take: 20 });
  return NextResponse.json({ data: posts });
}

export async function POST(request: Request) {
  const body = await request.json();
  const post = await db.post.create({ data: body });
  return NextResponse.json({ data: post }, { status: 201 });
}
```

## Express.js Pattern

```tsx
import express from 'express';
import { z } from 'zod';

const router = express.Router();

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

router.post('/posts', async (req, res) => {
  const result = CreatePostSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error });
  const post = await db.post.create({ data: result.data });
  res.status(201).json({ data: post });
});
```

## Guidelines
- Validate all input at the API boundary with Zod or similar.
- Version APIs when breaking changes are unavoidable: `/api/v2/users`.
- Paginate list endpoints by default.
- Use consistent error formats across all endpoints.
