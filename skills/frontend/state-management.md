# State Management

## When to use
When deciding how to manage state across a React application.

## Decision Framework

| Scope | Solution |
|-------|----------|
| Single component | `useState` / `useReducer` |
| Parent → child (1-2 levels) | Props |
| Subtree (3+ levels) | React Context |
| Global / complex | Zustand, Jotai, or Redux Toolkit |
| Server state | TanStack Query (React Query) or SWR |
| URL state | Search params via router |
| Form state | React Hook Form or native controlled inputs |

## Best Practices

- **Server state is not client state.** Use TanStack Query or SWR for data fetching — they handle caching, revalidation, and deduplication.
- **Derive, don't store.** If a value can be computed from existing state, compute it inline or with `useMemo`. Don't sync it into separate state.
- **Lift state only as high as needed.** If only two sibling components share state, lift to their nearest common parent — not to the app root.
- **Context is for low-frequency updates.** Theme, locale, auth status. Not for rapidly changing data like form inputs or animations.

## Zustand Quick Start

```tsx
import { create } from 'zustand';

interface CounterStore {
  count: number;
  increment: () => void;
  reset: () => void;
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));
```
