---
tags: [performance, code-splitting, lazy-loading, memoization, virtualization, bundle-size, images]
---

# Performance

## When to use
Every production app. But **don't optimize prophylactically** — measure first, fix the real bottleneck, move on. Most React perf problems are bundle size, unvirtualized long lists, or unoptimized images — not missing `useMemo`.

## Guidelines

- **Measure first, always.** Chrome DevTools Performance tab, React DevTools Profiler, Lighthouse, WebPageTest. If you can't point at a metric that moved, your optimization didn't happen.
- **Code splitting:**
  - `React.lazy(() => import('./Heavy'))` wrapped in `<Suspense>` for heavy modals, editors, charts, anything not needed on first paint.
  - Next.js auto-splits by route; focus lazy imports on *non-route* heavy components (rich text editors, chart libs, PDF viewers).
  - Vite: dynamic `import()` creates separate chunks automatically.
- **Virtualization:** Use `@tanstack/react-virtual` when rendering more than ~200 rows/cards. Breaks browser find-in-page — provide an in-app search input to compensate.
- **`useMemo` / `useCallback`:** Only when (a) profiling shows the recompute is expensive OR (b) passing a stable reference to a `React.memo`-wrapped child. Sprinkling them everywhere **slows things down** — the comparison isn't free.
- **`React.memo`** on pure leaf components that re-render often (list items, table cells).
- **Images:** Next.js `<Image>` handles sizing, formats (AVIF/WebP), and lazy loading. For Vite, use `vite-plugin-image-optimizer` or pre-optimize via CDN (Cloudflare Images, Cloudinary). Always set `loading="lazy"` on below-fold `<img>` tags.
- **Bundle analysis:** `@next/bundle-analyzer` or `rollup-plugin-visualizer` (Vite). Run it at least monthly, or any time you add a dependency larger than 20kB gzipped.
- **Tree-shake imports:** `import { debounce } from 'lodash-es'`, not `import _ from 'lodash'`. Same for `date-fns`, `rxjs`, `@mui/*`. Check your bundle — the wrong import can drag in 400kB.
- **Fonts:** preload critical fonts (`<link rel="preload" as="font">`), use `font-display: swap` to avoid FOIT (flash of invisible text). Self-host or use `next/font` for zero layout shift.
- **Avoid re-rendering the world on context change:** split contexts by update frequency. An auth context (rarely changes) and a cart context (changes often) should be separate.

## Examples

### Lazy route / modal

```tsx
import { lazy, Suspense } from 'react';

const RichEditor = lazy(() => import('./RichEditor'));

function PostForm() {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <Suspense fallback={<EditorSkeleton />}>
      <RichEditor />
    </Suspense>
  ) : (
    <button onClick={() => setEditing(true)}>Edit</button>
  );
}
```

### Virtualized list

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function BigList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
        {virt.getVirtualItems().map((v) => (
          <div key={v.key}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%',
              transform: `translateY(${v.start}px)`, height: v.size,
            }}>
            <Row item={items[v.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Tree-shaking good vs bad

```ts
// BAD — imports all of lodash (~70kB gz)
import _ from 'lodash';
_.debounce(fn, 300);

// GOOD — imports only debounce (~2kB gz)
import { debounce } from 'lodash-es';
debounce(fn, 300);
```

### Memoized leaf

```tsx
export const TableRow = React.memo(function TableRow({ row, onSelect }: Props) {
  return <tr onClick={() => onSelect(row.id)}>{/* ... */}</tr>;
});

// In parent — stabilize the callback or the memo is wasted
const onSelect = useCallback((id: string) => { /* ... */ }, []);
```

### Next.js image

```tsx
import Image from 'next/image';

<Image src="/hero.jpg" alt="Team working together"
  width={1200} height={600} priority sizes="(max-width: 768px) 100vw, 1200px" />
```

## Checklist
- [ ] Baseline measured (Lighthouse, Profiler) before and after changes
- [ ] Route-level code splitting in place; heavy non-route modules lazy-loaded
- [ ] Lists over ~200 items are virtualized
- [ ] Bundle analyzer run; no surprise large dependencies
- [ ] Images served via `<Image>` or equivalent with lazy loading
- [ ] Fonts preloaded with `font-display: swap`
- [ ] `useMemo` / `useCallback` justified by profiling or `React.memo` boundaries
- [ ] Named imports from tree-shakeable packages
