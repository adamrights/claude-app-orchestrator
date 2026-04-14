---
tags: [caching, redis, http-cache, cdn, cache-invalidation, cache-stampede]
---

# Caching

## When to use
High-read endpoints where the data doesn't change every request, expensive computations, rate-limit state, sessions, job-queue fan-out. If a query shows up in the top 5 of your slow-log and the response can be stale for even 10 seconds, cache it.

Do **not** cache: user-specific data at the CDN layer, auth endpoints, anything with side effects, data with strict staleness SLAs.

## Guidelines

- **Layer your caches.** In descending order of speed: browser → CDN edge → Redis / app-level → origin DB. Each layer has a different invalidation strategy — plan for all of them.
- **HTTP cache headers:**
  - `Cache-Control: public, max-age=60` for shared caches (CDN + browser)
  - `Cache-Control: private, max-age=60` for per-user (browser only)
  - `Cache-Control: no-store` for secrets / auth tokens
  - `ETag` + `If-None-Match` for conditional 304 responses (saves bandwidth, not origin load)
  - `stale-while-revalidate=120` — clients/CDNs may serve stale for 2 min while refetching in background
- **CDN edge caching:** Vercel and Cloudflare cache based on `Cache-Control` by default. For Next.js App Router, use `export const revalidate = 60` on routes, or `fetch(url, { next: { revalidate: 60, tags: ['posts'] } })` for tag-based revalidation.
- **Redis patterns:**
  - `SETEX key 60 value` — TTL-based simple cache
  - `HGETALL key` / `HSET key field val` — structured data
  - `GET-then-SET-NX` for stampede protection (only one fetcher rebuilds)
  - Pub/Sub (`PUBLISH invalidation posts`) for cross-instance cache busting
- **Cache keys:** include everything that changes the value — user id, tenant, version. Example: `org:123:user:456:dashboard:v3`. Version suffix lets you instantly invalidate the whole namespace by bumping `v3` → `v4`.
- **Invalidation strategies** (pick one per resource):
  - **TTL-only** — simplest; may serve stale up to the TTL
  - **Write-through** — on write, update cache synchronously. Consistent but couples writes to cache health.
  - **Write-behind** — on write, queue the cache update async. Fast writes, eventual consistency.
  - **Invalidate-on-write** — on write, `DEL` the cache key. Next read repopulates. Best default.
- **Cache stampede:** when a hot key expires, 1,000 concurrent requests all try to rebuild. Mitigations: `SETNX` lock while rebuilding; probabilistic early expiration (rebuild with probability `p` as TTL approaches); serve-stale-while-revalidating.
- **Negative caching:** cache 404s and "user has no X" results too, with a shorter TTL (~30s). Otherwise a missing record causes DB hammering.
- **Observability:** track hit rate, miss rate, evictions. A cache with <80% hit rate is probably miskeyed.

## Examples

### Redis `getOrSet` helper with stampede lock

```ts
import { redis } from './redis';

export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  // Acquire build lock (5s) — losers wait and re-read
  const lockKey = `lock:${key}`;
  const gotLock = await redis.set(lockKey, '1', { NX: true, EX: 5 });
  if (!gotLock) {
    await new Promise((r) => setTimeout(r, 50));
    const after = await redis.get(key);
    if (after) return JSON.parse(after) as T;
    return fetcher(); // fallback — don't deadlock
  }

  try {
    const value = await fetcher();
    await redis.set(key, JSON.stringify(value), { EX: ttlSec });
    return value;
  } finally {
    await redis.del(lockKey);
  }
}

// Usage
const user = await getOrSet(`user:${id}:v1`, 300, () => db.user.findUnique({ where: { id } }));
```

### Invalidate-on-write

```ts
export async function updateUser(id: string, patch: UserPatch) {
  const updated = await db.user.update({ where: { id }, data: patch });
  await redis.del(`user:${id}:v1`);
  return updated;
}
```

### Next.js tag-based revalidation

```ts
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60, tags: ['posts'] },
  });
  return res.json();
}

// After mutation — instantly invalidate all consumers of 'posts'
import { revalidateTag } from 'next/cache';
await revalidateTag('posts');
```

### HTTP headers on an API route

```ts
// app/api/articles/[slug]/route.ts
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=30' }, // negative cache
    });
  }
  return Response.json(article, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      ETag: `"${article.version}"`,
    },
  });
}
```

## Checklist
- [ ] Every cacheable endpoint has explicit `Cache-Control` headers
- [ ] CDN caches only public, non-user-specific responses
- [ ] Redis cache keys include tenant/user/version segments
- [ ] Stampede protection via lock or probabilistic expiration on hot keys
- [ ] Invalidation strategy documented per resource (TTL, write-through, invalidate-on-write)
- [ ] Negative responses (404, empty) cached with short TTL
- [ ] Hit rate and eviction metrics exported
- [ ] Auth / per-user data never cached at shared layers
