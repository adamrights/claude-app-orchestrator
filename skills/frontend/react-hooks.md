# React Hooks Patterns

## When to use
When working with state, side effects, or extracting reusable logic in React.

## Core Hook Guidelines

### useState
- Use for local UI state (form inputs, toggles, counters).
- Prefer a single object state for related values over multiple `useState` calls.
- Use functional updates (`setState(prev => ...)`) when new state depends on previous state.

### useEffect
- Always specify a dependency array.
- Return a cleanup function for subscriptions, timers, and event listeners.
- Avoid setting state in effects that triggers re-renders — derive values instead.

### useMemo / useCallback
- Only use when there's a measured performance problem or a stable reference is required (e.g., dependency of another hook).
- Don't wrap every function or value — React re-renders are fast.

### Custom Hooks
- Name with `use` prefix: `useAuth`, `useFetch`, `useDebounce`.
- Extract when logic is shared across 2+ components or when a component's hook logic exceeds ~20 lines.
- Return a tuple `[value, actions]` or an object — be consistent within the project.

## Example: Custom Data Fetching Hook

```tsx
import { useState, useEffect } from 'react';

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(url, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(err => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url]);

  return { data, error, loading };
}
```
