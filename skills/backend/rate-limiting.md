---
tags: [rate-limiting, throttle, api-protection, ddos, abuse]
---

# Rate Limiting

## When to use
Every public-facing API endpoint, especially authentication endpoints (login, signup, password reset), webhook receivers, and any endpoint that performs expensive operations (file uploads, email sends, AI inference). Rate limiting is a baseline security requirement, not an optimization.

## Guidelines

- **Rate-limit all public endpoints by default.** Opt out selectively (health checks, internal service calls), not the other way around.
- **Use tiered limits.** Auth endpoints get strict limits (e.g., 5 requests/minute). Read endpoints get relaxed limits (e.g., 100 requests/minute). Write endpoints sit in between.
- **Choose the right identifier:** per-IP for unauthenticated requests, per-user or per-API-key for authenticated ones. Per-IP alone is insufficient for APIs behind shared proxies.
- **Return standard headers** on every response:
  - `X-RateLimit-Limit` — max requests in the window
  - `X-RateLimit-Remaining` — requests left in the current window
  - `X-RateLimit-Reset` — Unix timestamp when the window resets
- **Return 429 Too Many Requests** when the limit is exceeded, with a `Retry-After` header (seconds until the client can retry).
- **Use Redis-backed stores for distributed deployments.** In-memory stores only work for single-instance apps. Upstash Redis works well for serverless.
- **Do not rate-limit health checks** (`/health`, `/ready`) or internal service-to-service calls.
- **Log rate-limit hits** for monitoring. Sudden spikes in 429s indicate abuse or a misconfigured client.
- **Algorithms:** Token bucket is best for bursty traffic. Sliding window is simpler and prevents burst-at-boundary issues. Fixed window is the simplest but allows double-burst at window edges.

## Hono Rate Limiter

```tsx
import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';

const app = new Hono();

// General rate limit
const generalLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
});

// Strict rate limit for auth
const authLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
});

app.use('/api/*', generalLimiter);
app.use('/api/auth/*', authLimiter);
```

## Next.js API Rate Limiter (with Upstash)

```tsx
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  // Handle the request normally
  return NextResponse.json({ data: 'ok' });
}
```

## Checklist
- [ ] All public endpoints have rate limiting applied
- [ ] Auth endpoints have stricter limits than general endpoints
- [ ] Rate limit responses include standard headers and 429 status
- [ ] `Retry-After` header is included in 429 responses
- [ ] Redis-backed store is used for multi-instance deployments
- [ ] Health checks and internal calls are excluded from rate limiting
- [ ] Rate limit hits are logged for monitoring
