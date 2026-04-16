---
tags: [react, hooks, state, effects, custom-hooks, useid, usesyncexternalstore, usetransition]
---

# React Hooks Patterns

## When to use
When working with state, side effects, derived values, or extracting reusable logic in React 18+.

## Core hook guidelines

### `useState`
- Local UI state only — form inputs, toggles, hover/focus, transient UI.
- Group **related** values into one object; keep **independent** values separate.
- Functional updates (`setState(prev => ...)`) when the new state derives from the previous.
- If 3+ booleans describe the same flow, the smell is a state machine — see `state-machines.md`.

### `useReducer`
- Reach for it when state transitions are non-trivial (multi-step flows, conditional next states, side-effect-y reducers).
- Discriminated-union `state` type makes invalid states unrepresentable. See `state-machines.md`.

### `useEffect`
- **Default to no `useEffect`.** Most "I need to do X when Y changes" cases should be derived state, an event handler, or a render-time computation.
- Always specify the dependency array. Disable `react-hooks/exhaustive-deps` only with a comment explaining why — never silently.
- Return a cleanup for subscriptions, timers, listeners, abort controllers.
- Don't fetch in `useEffect` for new code — use TanStack Query (`data-fetching.md`) or RSC (`server-components.md`).

### `useLayoutEffect`
- Only for DOM measurements that must run before paint (e.g., positioning a tooltip relative to a measured anchor).
- Blocks paint — every other case wants `useEffect`.

### `useMemo` / `useCallback`
- Two valid reasons: (a) **profiler-measured** expensive recompute, or (b) **stable reference** required as a hook dep or `React.memo` prop.
- Sprinkling them everywhere costs allocation + comparison without gains.
- React 19's compiler ("React Forget") auto-memoizes — manual memoization becomes mostly unnecessary in those projects.

### `useRef`
- Mutable values that don't trigger re-renders (timers, AbortController, last-seen value).
- DOM refs (`useRef<HTMLDivElement>(null)`).
- Avoid storing render-affecting state in refs — that's what `useState` is for.

### `useImperativeHandle`
- Rare. Only when a parent legitimately needs imperative API on a child (`focus()`, `scrollIntoView()`, `play()` on a video).
- Always pair with `forwardRef`.

### `useId`
- SSR-safe stable ID for `<label htmlFor>`, `aria-describedby`, `aria-labelledby`. Replaces ad-hoc `useState(() => 'id-' + Math.random())`.

### `useTransition` / `startTransition`
- Mark a state update as non-urgent; React keeps the previous UI interactive while rendering the new one.
- Use case: heavy filtering/search, tab switches with expensive panels.
- Don't wrap every update — only the **expensive, non-urgent** ones. See `concurrent-react.md`.

### `useDeferredValue`
- Defer a derived value's downstream renders. Different from debouncing — priority-based, not time-based.
- Use case: typeahead input where the input itself stays responsive but the expensive results list lags.

### `useSyncExternalStore`
- Subscribing to non-React state stores (Zustand, Redux, browser APIs like `matchMedia`, `online` status, `localStorage` events).
- SSR-safe (`getServerSnapshot`). The right primitive for "snapshot of an external mutable thing."

### `useInsertionEffect`
- For CSS-in-JS library authors only. App code should never need this.

### Custom hooks
- Name with `use` prefix.
- Extract when logic is shared across 2+ components OR a component's hook block exceeds ~20 lines.
- Return a tuple `[value, actions]` for two-element APIs, an object for three or more — be consistent within the codebase.
- Custom hooks compose other hooks; they are not "containers" — no special lifecycle, no special tools.

## Examples

### `useId` for accessible labels

```tsx
import { useId } from 'react';

export function Field({ label, ...inputProps }: { label: string } & React.ComponentPropsWithoutRef<'input'>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...inputProps} />
    </div>
  );
}
```

### `useTransition` for non-urgent updates

```tsx
import { useState, useTransition } from 'react';

export function Search({ items }: { items: Item[] }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(items);
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);                              // urgent — input stays responsive
    startTransition(() => {
      setFiltered(items.filter(i => i.name.includes(q)));  // non-urgent
    });
  }

  return (
    <>
      <input value={query} onChange={onChange} />
      <List items={filtered} dim={isPending} />
    </>
  );
}
```

### `useDeferredValue` for slow downstream

```tsx
import { useDeferredValue, useState, useMemo } from 'react';

export function Typeahead({ all }: { all: Item[] }) {
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);  // results list trails the input under load
  const results = useMemo(() => all.filter(x => x.name.includes(deferredQ)), [all, deferredQ]);
  return (
    <>
      <input value={q} onChange={e => setQ(e.target.value)} />
      <SlowResults items={results} stale={q !== deferredQ} />
    </>
  );
}
```

### `useSyncExternalStore` for `prefers-color-scheme`

```tsx
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  const m = window.matchMedia('(prefers-color-scheme: dark)');
  m.addEventListener('change', callback);
  return () => m.removeEventListener('change', callback);
}

export function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => false   // SSR fallback
  );
}
```

### Custom hook with cleanup + AbortController

```tsx
import { useEffect, useState } from 'react';

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(url, { signal: ac.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [url]);

  return { data, error, loading };
}
```

(For real apps prefer TanStack Query — this example is to show the cleanup discipline.)

## Antipatterns

- **`useEffect` to sync state that's derivable from props.** Compute it during render.
- **`useEffect` to fetch data.** Use TanStack Query, RSC, or a route loader.
- **`useState(() => Math.random())` for IDs.** Use `useId`.
- **Reading `ref.current` during render.** Refs aren't reactive; render won't re-run when they change.
- **Conditionally calling hooks.** Hooks must run in the same order every render — no early returns above hook calls.
- **Stale closures.** When a setter or callback captures old state, switch to functional updates or move the value to a ref.

## Checklist
- [ ] No `useEffect` for derivable state or for fetching (in new code)
- [ ] All effects clean up subscriptions/timers/abort controllers
- [ ] `react-hooks/exhaustive-deps` lint rule passes (no silent disables)
- [ ] `useId` used for labels and ARIA relationships
- [ ] Heavy non-urgent updates wrapped in `useTransition`/`useDeferredValue`
- [ ] External stores read via `useSyncExternalStore`
- [ ] `useMemo`/`useCallback` justified by profiler or `memo` boundary
- [ ] Custom hooks share logic across 2+ call sites or replace > 20 lines of hook code
