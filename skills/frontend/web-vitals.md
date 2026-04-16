---
tags: [react, performance, web-vitals, lcp, inp, cls, lighthouse, profiling, bundle-size]
---

# Web Vitals & Performance

## When to use
Continuously, not as a "perf pass" before launch. Performance is a feature with a long-tail debt curve: regressions sneak in via dependencies, third-party scripts, and innocent-looking renders. Wire up production measurement on day one, set budgets, and treat regressions as bugs.

## Guidelines

- **Know the metrics that ship to users.** Google Core Web Vitals as of 2024:
  - **LCP** (Largest Contentful Paint) — when the biggest above-the-fold element renders. Target **< 2.5s** at p75.
  - **INP** (Interaction to Next Paint) — replaced FID in March 2024. Worst-case interaction latency across the session. Target **< 200ms** at p75.
  - **CLS** (Cumulative Layout Shift) — visual stability. Target **< 0.1** at p75.
- **Supporting metrics:** **TTFB** bounds LCP (you can't paint before bytes arrive). **TTI** and **Total Blocking Time** bound INP. **FCP** matters for perceived speed.
- **Measure synthetically AND in production. Both are mandatory.**
  - Synthetic: Lighthouse (CI + local), WebPageTest for deep dives. Reproducible, but doesn't reflect real-user device/network distribution.
  - Real-user: the **`web-vitals`** npm package piped to your analytics (Sentry, Datadog RUM, PostHog, Vercel Analytics, Cloudflare Web Analytics). This is the source of truth — synthetic numbers can pass while p75 users suffer.
- **LCP optimization checklist:**
  - Identify the LCP element (Lighthouse will tell you). Usually a hero image, headline, or video poster.
  - Use `next/image` (or equivalent) with `priority` and an explicit `fetchPriority="high"` on the LCP image. Ensure responsive `sizes`.
  - **Preload critical fonts.** Self-host with `next/font`; use `display: swap` or `optional` strategically.
  - Inline critical CSS for above-the-fold content. Most frameworks do this — verify.
  - Avoid render-blocking JS. Defer/async third-party scripts; use `next/script` with `strategy="lazyOnload"` for analytics.
- **INP optimization checklist:**
  - Profile interactions in the Chrome Performance panel — find tasks > 50ms in the handler.
  - **Yield to the main thread.** Use `await scheduler.yield()` (Chrome 129+) or `await new Promise(r => setTimeout(r, 0))` to break long synchronous work.
  - **Defer non-urgent state updates with `useTransition` and `useDeferredValue`.** See `concurrent-react.md`. Wrapping a heavy filter in `startTransition` keeps the input responsive.
  - Avoid huge synchronous handlers — split work, debounce expensive computation, memoize derived values.
  - Audit third-party scripts; analytics tags are a top INP offender.
- **CLS optimization checklist:**
  - **Always set `width` and `height` (or `aspect-ratio`) on `<img>` and `<video>`.** `next/image` enforces this.
  - Reserve space for dynamically loaded content with skeletons of the correct size — not a tiny spinner that gets replaced by a 400px card.
  - Avoid inserting content above existing content (banners, cookie notices). Use overlays or push from the bottom.
  - Choose font strategy carefully: `font-display: swap` causes FOUT (text shift); `optional` avoids shift but may skip the custom font on slow connections. Use `next/font` with `adjustFontFallback` to align metrics.
- **React Profiler API for production-safe profiling.** `<Profiler id onRender>` has low overhead and works in prod. Sample, aggregate, and ship to your analytics. React DevTools Profiler is for local investigation only.
- **Bundle size: measure, then enforce.**
  - `next build` prints first-load JS per route. **Aim for < 100KB gzipped first-load JS** on the critical path.
  - Use `@next/bundle-analyzer` to find bloat. Common culprits: moment.js (use date-fns or `Intl`), lodash full import (use `lodash-es` + tree-shake or `lodash/foo`), icon libraries imported wholesale.
  - Dynamic-import below-the-fold components (`next/dynamic` with `ssr: false` for client-only widgets).
- **Performance budgets in CI.** Pick at least one of: Lighthouse CI (`@lhci/cli`), `size-limit` per package, or `bundlewatch`. Fail the build on regression. Without a budget, perf decays.
- **Hydration mismatches are silent perf killers.** Cause INP and CLS spikes plus client re-renders. Triggered by `Date.now()`, `Math.random()`, locale-dependent date formatting, or browser-only state read in render. Fix at the source — don't suppress with `suppressHydrationWarning` unless you genuinely understand why.
- **When NOT to optimize:** below the budget already. Don't memoize, code-split, or virtualize speculatively. Measure first.

## Examples

### `web-vitals` reporter wired to PostHog

```tsx
// app/web-vitals.tsx
'use client';
import { useEffect } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import posthog from 'posthog-js';

function send(metric: Metric) {
  posthog.capture('web_vital', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    id: metric.id,
    navigationType: metric.navigationType,
    path: window.location.pathname,
  });
}

export function WebVitals() {
  useEffect(() => {
    onCLS(send);
    onFCP(send);
    onINP(send);
    onLCP(send);
    onTTFB(send);
  }, []);
  return null;
}

// app/layout.tsx
// <WebVitals /> mounted once near the root
```

### Profiler usage for a hot subtree

```tsx
import { Profiler, type ProfilerOnRenderCallback } from 'react';

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (actualDuration > 16) {
    // dropped a frame — sample and ship
    posthog.capture('slow_render', { id, phase, actualDuration });
  }
};

export function Dashboard() {
  return (
    <Profiler id="dashboard" onRender={onRender}>
      <DashboardContent />
    </Profiler>
  );
}
```

### LCP image done right

```tsx
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Product hero"
      width={1600}
      height={900}
      priority
      fetchPriority="high"
      sizes="(max-width: 768px) 100vw, 1200px"
      className="h-auto w-full"
    />
  );
}
```

### Yielding to the main thread

```ts
// Break long work into yieldable chunks for INP
async function processItems<T, R>(items: T[], fn: (item: T) => R): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(fn(items[i]));
    if (i % 50 === 49) {
      // Use scheduler.yield() if available, fallback to setTimeout
      const scheduler = (globalThis as { scheduler?: { yield: () => Promise<void> } }).scheduler;
      if (scheduler?.yield) {
        await scheduler.yield();
      } else {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
  }
  return results;
}
```

### Lighthouse CI config sketch

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/dashboard'],
      numberOfRuns: 3,
      startServerCommand: 'pnpm start',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'unused-javascript': ['warn', { maxNumericValue: 50000 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
```

## Antipatterns

- **Optimizing without measuring.** "I memoized everything" rarely moves the needle and often hurts.
- **Lighthouse-driven development with no RUM.** Synthetic 100s and p75 INP > 500ms in production happens constantly.
- **Sprinkling `useMemo`/`useCallback` everywhere.** They have a cost; use them when the dependency closure is genuinely expensive or downstream `React.memo` depends on referential stability.
- **Loading analytics/chat scripts blocking.** Always defer; preferably load after `requestIdleCallback`.
- **Unbounded list rendering.** Anything > 200 rows needs virtualization (TanStack Virtual).
- **Suppressing hydration warnings.** They mean something is wrong — fix it.
- **No bundle budget in CI.** First-load JS will creep above 500KB without anyone noticing.

## Checklist
- [ ] `web-vitals` package wired to your analytics in production
- [ ] LCP image uses `priority` + `fetchPriority="high"` + explicit dimensions
- [ ] All images/videos have width/height (or aspect-ratio)
- [ ] Fonts self-hosted via `next/font` with appropriate `display` strategy
- [ ] Long handlers yield to the main thread or use `useTransition`
- [ ] No render-blocking third-party scripts above the fold
- [ ] First-load JS measured per route; budget enforced in CI
- [ ] Lighthouse CI (or equivalent) runs on every PR
- [ ] Zero hydration warnings in console
- [ ] Profiler wraps known-hot subtrees in production
