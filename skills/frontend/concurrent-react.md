---
tags: [react, concurrent, suspense, transitions, useDeferredValue, useTransition, error-boundary, react-19]
---

# Concurrent React

## When to use
Any React 18+ app with non-trivial interactive UI: large filterable lists, typeahead search over expensive renders, tab switchers that swap heavy subtrees, lazy routes, or anywhere a user-perceptible jank appears during fast input. Concurrent features let you keep the UI responsive while React works on a slow update in the background.

## Guidelines

- **Mental model:** React 18's renderer can pause, resume, and abandon work. State updates can be marked as **transitions** (low priority) so urgent updates (typing, clicks) preempt them. The previous UI stays interactive until the new render is ready.
- **`useTransition` for explicit transitions you initiate.** Returns `[isPending, startTransition]`. Wrap the *state setter call*, not the event itself. Use when *you* trigger an expensive update (route change, tab switch, applying a filter).
- **`useDeferredValue` for derived/downstream values you receive.** Pass it a value that changes frequently; it returns a "deferred" copy that lags behind under load. Use when an input value drives an expensive child (typeahead → big list).
- **Debounce vs `useDeferredValue`:** debouncing is time-based and *drops* intermediate values — bad for responsiveness when the user pauses briefly. `useDeferredValue` is priority-based and always commits the freshest value React can fit; the deferred subtree shows the stalest acceptable version. Prefer `useDeferredValue` when input is React state; reach for debounce only when the bottleneck is network/IO and you want fewer requests.
- **`<Suspense>` is a primitive, not just a data-fetching helper.** Anything that throws a Promise during render suspends — `React.lazy` components, RSC streams, TanStack Query's `useSuspenseQuery`, Relay, custom resources. Suspense declares the *loading boundary*; what suspends is up to the children.
- **Every `<Suspense>` needs an `<ErrorBoundary>` above it.** Suspense handles the *loading* state; an error boundary handles the *error* state. Without one, a thrown error inside the boundary unmounts the whole tree.
- **Place Suspense boundaries thoughtfully.** Too high → the whole page flashes a fallback. Too low → too many spinners. Wrap each independent slow subtree.
- **`useId` for stable IDs.** Use for any ID that must match between server-rendered HTML and client hydration (form `htmlFor`, ARIA `aria-describedby`). Never `Math.random()` or a module-level counter — both break SSR.
- **React 19 + the React Compiler:** when the compiler is enabled, manual `useMemo`/`useCallback`/`React.memo` are largely unnecessary — the compiler memoizes for you. Concurrent primitives (`startTransition`, `useDeferredValue`, `<Suspense>`) remain essential; they aren't about CPU work, they're about *scheduling priority*.
- **`startTransition` is not a perf optimization for cheap updates.** Wrapping a `setIsOpen(true)` in a transition is pointless. Reserve it for updates that take >16ms and where keeping the previous UI usable matters.
- **Don't gate urgent feedback on a transition.** The input's controlled value (`value`/`onChange`) must be an *urgent* update so the cursor stays in sync. The expensive derived state (filtered results) is what becomes deferred.

### When NOT to use these

- **Cheap state updates.** A toggle, a modal open/close, a small form field — no transition needed.
- **Updates the user *should* wait for.** A "Save" button's pending state shouldn't be a transition; you want explicit `isSubmitting` UX.
- **Anywhere the perceived staleness is unacceptable.** Don't defer a value that drives a "current price" or a security-relevant indicator.

## Examples

### Filterable list with `useDeferredValue`

```tsx
import { useDeferredValue, useMemo, useState } from 'react';

type Row = { id: string; name: string; email: string };

export function UserSearch({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  // The input stays responsive; the deferred value lags under load.
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, deferredQuery]);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 120ms' }}>
        {filtered.map((r) => (
          <ExpensiveRow key={r.id} row={r} />
        ))}
      </ul>
    </>
  );
}
```

### Tab switcher with `useTransition`

```tsx
import { useState, useTransition } from 'react';

const TABS = ['overview', 'analytics', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function Tabs() {
  const [tab, setTab] = useState<Tab>('overview');
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <nav>
        {TABS.map((t) => (
          <button
            key={t}
            aria-current={t === tab}
            disabled={isPending && t === tab}
            onClick={() => startTransition(() => setTab(t))}
          >
            {t}
          </button>
        ))}
      </nav>
      <section style={{ opacity: isPending ? 0.7 : 1 }}>
        {tab === 'overview' && <OverviewPane />}
        {tab === 'analytics' && <AnalyticsPane />}
        {tab === 'settings' && <SettingsPane />}
      </section>
    </>
  );
}
```

### Lazy route with Suspense + ErrorBoundary

```tsx
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const SettingsRoute = lazy(() => import('./routes/settings'));

export function App() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert">
          <p>Failed to load settings: {error.message}</p>
          <button onClick={resetErrorBoundary}>Retry</button>
        </div>
      )}
    >
      <Suspense fallback={<RouteSkeleton />}>
        <SettingsRoute />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### SSR-safe IDs with `useId`

```tsx
import { useId } from 'react';

export function LabeledInput({ label, ...props }: { label: string } & React.ComponentPropsWithoutRef<'input'>) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={errorId} {...props} />
      <p id={errorId} hidden />
    </>
  );
}
```

## Antipatterns

- **Wrapping the input's `setQuery` in `startTransition`.** The input becomes laggy because its own value update is now low-priority. Keep the controlled value urgent; defer the derived value with `useDeferredValue`.
- **`useDeferredValue` on a value that isn't expensive downstream.** It adds overhead for no benefit. Profile first; only defer if the children are slow to render.
- **Debouncing React state updates to "fix" jank.** You drop intermediate keystrokes and the UI feels sticky. Use `useDeferredValue` for in-process work; debounce only for network calls.
- **Single top-level `<Suspense>` around an entire route.** The page flashes a giant skeleton on every navigation. Place Suspense around independent slow subtrees.
- **Suspense without an ErrorBoundary above it.** A thrown promise inside the boundary will pause; a thrown *error* will tear down the tree until something catches it.
- **Module-level counters for IDs (`let n = 0; const id = `field-${n++}`).** Mismatched between SSR and hydration → React warns and rebuilds. Always `useId`.
- **Adding `useMemo` everywhere "just in case" in a React 19 + Compiler codebase.** The compiler is doing this work; manual memoization clutters the source and can defeat the compiler's analysis.

## Checklist

- [ ] Expensive list/filter UIs use `useDeferredValue` (not debounce) for in-process work
- [ ] Tab/route switches that swap heavy subtrees use `useTransition` with `isPending` UX
- [ ] Input controlled values are urgent; only the derived/expensive consequence is deferred
- [ ] Every `<Suspense>` has an `<ErrorBoundary>` above it
- [ ] Suspense boundaries wrap independent slow subtrees, not the entire page
- [ ] All form/ARIA IDs come from `useId`
- [ ] Lazy routes are wrapped in Suspense + ErrorBoundary with a retry path
- [ ] No `startTransition` around trivially fast updates
