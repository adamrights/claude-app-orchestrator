---
tags: [data-fetching, tanstack-query, react-query, mutations, invalidation, prefetching, cache]
---

# Data Fetching

## When to use
Any React app that reads server data. **Never use raw `useEffect` + `fetch` in production code** — you'll reinvent caching, deduplication, retries, and stale handling, and get it wrong. TanStack Query (React Query) is the default for CSR; for Next.js App Router you can also use server components directly.

## Guidelines

- **One `QueryClient` per app.** Wrap the tree in `<QueryClientProvider client={client}>` at the root. Create the client in a `useState` initializer so it's stable across renders.
- **Query keys:** `['resource', params]` tuples. Keep them consistent — use a `queryKeys` factory for anything non-trivial so typos don't create cache misses.
- **`staleTime`:** how long data is considered fresh (no refetch). Tune per endpoint — 5 min for user profile, 10s for inbox, 0 for real-time dashboards. Default (0) is too aggressive for most apps; set a sensible default on the `QueryClient`.
- **`gcTime` (formerly `cacheTime`):** how long unused data is kept in memory. Default 5 min is fine.
- **Mutations:** `useMutation` + `onSuccess` that invalidates related queries. Don't manually `setQueryData` unless you need optimistic updates — invalidation is safer.
- **Optimistic updates:** in `onMutate`, snapshot current data with `getQueryData`, apply the expected change, return the snapshot. In `onError`, restore from the snapshot. In `onSettled`, invalidate to resync with the server.
- **`placeholderData: keepPreviousData`** during pagination so the old page stays visible while the new one fetches.
- **Prefetching:** call `queryClient.prefetchQuery` on link/button hover for instant-feeling nav.
- **Suspense mode:** `useSuspenseQuery` throws the promise and pairs with `<Suspense>`. Cleaner code, but you lose `isLoading` as a discriminator — error boundaries handle errors.
- **Error boundaries:** set `throwOnError: true` on a query (or globally via `QueryClient` defaults) to escalate errors up to the nearest `<ErrorBoundary>`.
- **Never `refetch()` on an interval.** Use the `refetchInterval` option; it auto-pauses when the window is hidden and cleans up on unmount.
- **Don't fetch in child components what the parent already fetched.** Share via props, or let both call the same hook (TanStack Query dedupes).

## Examples

### QueryClient setup

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

### Typed query hook with a key factory

```ts
export const queryKeys = {
  todos: {
    all: ['todos'] as const,
    list: (filters: TodoFilters) => [...queryKeys.todos.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.todos.all, 'detail', id] as const,
  },
};

export function useTodos(filters: TodoFilters) {
  return useQuery({
    queryKey: queryKeys.todos.list(filters),
    queryFn: () => api.todos.list(filters),
    staleTime: 30_000,
  });
}
```

### Mutation with invalidation

```tsx
export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTodo) => api.todos.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.todos.all }),
  });
}
```

### Optimistic update

```tsx
export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.todos.toggle(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.todos.all });
      const prev = qc.getQueryData<Todo[]>(queryKeys.todos.list({}));
      qc.setQueryData<Todo[]>(queryKeys.todos.list({}), (old) =>
        old?.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.todos.list({}), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.todos.all }),
  });
}
```

### Prefetch on hover

```tsx
function TodoLink({ id }: { id: string }) {
  const qc = useQueryClient();
  return (
    <Link href={`/todos/${id}`}
      onMouseEnter={() =>
        qc.prefetchQuery({
          queryKey: queryKeys.todos.detail(id),
          queryFn: () => api.todos.get(id),
          staleTime: 30_000,
        })
      }>
      View
    </Link>
  );
}
```

### Suspense + error boundary

```tsx
function TodoDetail({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: queryKeys.todos.detail(id),
    queryFn: () => api.todos.get(id),
  });
  return <article>{data.title}</article>;
}

// Usage
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<Spinner />}>
    <TodoDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

## Checklist
- [ ] Single `QueryClient` wraps the app; no ad-hoc fetches in components
- [ ] Query keys use a consistent factory; `staleTime` is tuned per endpoint
- [ ] Mutations invalidate related queries in `onSuccess`
- [ ] Optimistic updates snapshot + restore on error
- [ ] Pagination uses `placeholderData: keepPreviousData`
- [ ] Hover prefetching on navigation-heavy lists
- [ ] Polling uses `refetchInterval`, never `setInterval(refetch)`
- [ ] Errors escalate to an `<ErrorBoundary>` where appropriate
