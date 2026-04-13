# tRPC

## When to use

When building a type-safe RPC layer between frontend and backend in the same TypeScript monorepo. tRPC eliminates the need for REST route definitions and manual type declarations — the server's types flow directly to the client. Best suited for Next.js App Router or standalone Node servers where both ends share a single TypeScript codebase.

Prefer tRPC over REST when:
- Frontend and backend live in the same repo and deploy together.
- You want end-to-end type safety without code generation.
- The API is consumed by your own app, not third-party clients.

Prefer REST or GraphQL instead when:
- External consumers need a stable, documented API surface.
- The backend is in a different language.

## Router Structure

Organize routers by domain. Each domain gets its own file under `src/server/routers/`:

```
src/server/
  routers/
    _app.ts        # root router (merges all domain routers)
    todo.ts
    user.ts
  trpc.ts          # tRPC instance, context, middleware
```

Compose routers with nested `router()` calls or `mergeRouters`. Always export the root router's type for client inference:

```ts
// src/server/routers/_app.ts
import { router } from '../trpc';
import { todoRouter } from './todo';
import { userRouter } from './user';

export const appRouter = router({
  todo: todoRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
```

## Procedure Types

Use `query` for reads and `mutation` for writes. Validate input with `.input(zodSchema)`:

```ts
// src/server/routers/todo.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const todoRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(['all', 'active', 'completed']).default('all'),
    }))
    .query(async ({ input, ctx }) => {
      const where = input.status === 'all' ? {} : { completed: input.status === 'completed' };
      return ctx.db.todo.findMany({ where });
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.todo.create({
        data: { title: input.title, userId: ctx.session.user.id },
      });
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const todo = await ctx.db.todo.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.todo.update({
        where: { id: input.id },
        data: { completed: !todo.completed },
      });
    }),
});
```

## Context

Pass auth session and database client through context. Create context per-request:

```ts
// src/server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerSession();
  return { db, session, headers: opts.headers };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

## Middleware and Auth

Use middleware to enforce auth or other cross-cutting concerns. Don't repeat auth checks in every procedure:

```ts
// src/server/trpc.ts (continued)
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
```

## Error Handling

Always throw `TRPCError` with appropriate codes. Never throw raw `Error` objects — tRPC maps codes to HTTP status codes automatically:

- `NOT_FOUND` — resource doesn't exist
- `UNAUTHORIZED` — not authenticated
- `FORBIDDEN` — authenticated but not allowed
- `BAD_REQUEST` — invalid input (usually handled by Zod automatically)
- `INTERNAL_SERVER_ERROR` — unexpected failures

```ts
throw new TRPCError({
  code: 'NOT_FOUND',
  message: `Todo ${id} not found`,
});
```

## Client Setup

### React hooks (recommended for React apps)

```ts
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
```

Wrap your app with the tRPC provider (which includes TanStack Query):

```tsx
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({ links: [httpBatchLink({ url: '/api/trpc' })] })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### Vanilla client (for non-React or server-side)

```ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/api/trpc' })],
});

const todos = await client.todo.list.query({ status: 'active' });
```

## Using tRPC in Components

tRPC's React hooks wrap TanStack Query. Don't double-wrap with `useQuery` — use tRPC's hooks directly:

```tsx
function TodoList() {
  const { data: todos, isLoading } = trpc.todo.list.useQuery({ status: 'all' });
  const utils = trpc.useUtils();

  const createTodo = trpc.todo.create.useMutation({
    onSuccess: () => {
      utils.todo.list.invalidate();
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {todos?.map(todo => <TodoItem key={todo.id} todo={todo} />)}
      <AddTodoForm onSubmit={(title) => createTodo.mutate({ title })} />
    </div>
  );
}
```

## Optimistic Updates

Use tRPC mutation callbacks for optimistic updates. The pattern mirrors TanStack Query's optimistic update API:

```tsx
const toggleTodo = trpc.todo.toggle.useMutation({
  onMutate: async ({ id }) => {
    await utils.todo.list.cancel();
    const previous = utils.todo.list.getData({ status: 'all' });
    utils.todo.list.setData({ status: 'all' }, (old) =>
      old?.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      utils.todo.list.setData({ status: 'all' }, context.previous);
    }
  },
  onSettled: () => {
    utils.todo.list.invalidate();
  },
});
```

## Guidelines

- One router per domain, composed in a root router.
- Export `AppRouter` type — never import server code on the client, only the type.
- Use `publicProcedure` and `protectedProcedure` to make auth requirements explicit.
- Keep procedures thin — delegate business logic to a service layer.
- Use Zod schemas in `.input()` for validation; don't validate manually in the procedure body.
- Prefer `httpBatchLink` to reduce request count.

## Checklist

- [ ] Root router exports `AppRouter` type.
- [ ] All mutations use `protectedProcedure` (unless truly public).
- [ ] Input validated with Zod schemas via `.input()`.
- [ ] Errors thrown as `TRPCError` with appropriate codes.
- [ ] Client uses `createTRPCReact` (not manual fetch).
- [ ] Mutations invalidate relevant queries on success.
- [ ] No raw `Error` throws in procedures.
