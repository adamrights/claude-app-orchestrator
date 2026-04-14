---
tags: [pagination, cursor-pagination, offset-pagination, infinite-scroll, url-state]
---

# Pagination

## When to use
Any list endpoint that can return more than one page of results. Pick the strategy based on UX needs:

- **Cursor-based** — feeds, timelines, chat, activity streams. Stable under concurrent writes.
- **Offset-based** — admin panels, reports. Supports jump-to-page.
- **Infinite scroll** — content streams, media galleries, social feeds.

## Guidelines

- **Cursor-based (recommended for feeds):** Uses a stable sort key (usually `id` or `(createdAt, id)`) as the cursor. O(1) per page, stable under writes. Downsides: no page numbers, no "jump to page 47". API returns `{ data, nextCursor }`.
- **Offset-based:** Simple. Supports jump-to-page and total-page calculation. Becomes slow on deep offsets (`OFFSET 1000000` scans the first million rows) and is unstable under writes — new items shift pages. **Cap max offset at ~10,000** and force users to filter if they hit it.
- **Infinite scroll:** Cursor pagination under the hood + `IntersectionObserver` sentinel to auto-fetch. **Always include a visible "Load more" button as a fallback** — infinite scroll alone is inaccessible to keyboard users and breaks back-button restore.
- **URL state is mandatory.** `?page=2&size=25` for offset, `?cursor=abc123&size=25` for cursor. Never store pagination in `useState` alone — reload / share / back-button all break.
- **Page size options:** usually 10 / 25 / 50 / 100. Default to 25. Persist the user's last choice in localStorage.
- **Show total count only with offset pagination.** With cursor pagination, either hide it or compute an approximation (`SELECT reltuples FROM pg_class`) on a separate cheap query.
- **Prefetch the next page** on hover of the "Next" button with TanStack Query's `prefetchQuery` — feels instant.

## Examples

### Offset pagination with URL state

```tsx
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const params = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  const linkTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    return `?${next}`;
  };

  return (
    <nav aria-label="Pagination">
      <Link href={linkTo(page - 1)} aria-disabled={page <= 1}>Previous</Link>
      <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
      <Link href={linkTo(page + 1)} aria-disabled={page >= totalPages}>Next</Link>
    </nav>
  );
}
```

### Cursor pagination with `useInfiniteQuery`

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

type Page<T> = { data: T[]; nextCursor: string | null };

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }): Promise<Page<Post>> =>
      fetch(`/api/feed?cursor=${pageParam ?? ''}&size=25`).then((r) => r.json()),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}
```

### Infinite scroll with IntersectionObserver

```tsx
import { useEffect, useRef } from 'react';

export function Feed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasNextPage, fetchNextPage]);

  return (
    <>
      {data?.pages.flatMap((p) => p.data).map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={sentinelRef} aria-hidden />
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </>
  );
}
```

### Cursor API endpoint (Postgres)

```ts
// GET /api/feed?cursor=<id>&size=25
const size = Math.min(Number(req.query.size ?? 25), 100);
const rows = await db.post.findMany({
  take: size + 1, // fetch one extra to know if there's a next page
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
});
const nextCursor = rows.length > size ? rows[size - 1].id : null;
return { data: rows.slice(0, size), nextCursor };
```

## Checklist
- [ ] Strategy matches UX (cursor for feeds, offset for admin, infinite for streams)
- [ ] Pagination state lives in URL search params, not component state
- [ ] Offset pagination caps max page to prevent deep-scan DoS
- [ ] Infinite scroll has a fallback "Load more" button for a11y
- [ ] Page size options persist to localStorage
- [ ] Next page is prefetched on hover of the Next button
- [ ] Total count is only shown when cheaply computable (offset mode)
