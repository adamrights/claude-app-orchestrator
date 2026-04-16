---
tags: [react, components, forwardref, memo, controlled-uncontrolled, props]
---

# React Component Scaffolding

## When to use
When creating any React component — pages, primitives, feature modules, or shared widgets. The defaults below assume React 18+; React 19 deltas are called out inline.

## Guidelines

- **Functional components only.** Class components remain only for error boundaries (no functional API exists yet).
- **Don't use `React.FC`.** It implicitly adds `children`, doesn't infer generics, and adds nothing over typing props directly.
- **Co-locate** related files: `Component.tsx`, `Component.test.tsx`, `Component.module.css`. Avoid `index.ts` barrel files inside feature folders — they wreck tree-shaking and lengthen tracebacks.
- **Props interface named `{Component}Props`.** Export it only when consumers compose with it.
- **Single responsibility.** A component either renders UI, owns state, or coordinates children — not all three. Components over ~150 lines are usually doing too much.
- **Extend native element props correctly:** `extends React.ComponentPropsWithoutRef<'button'>` (or `'input'`, `'a'`, etc.) — don't manually re-declare event handlers. See `typescript-patterns.md`.
- **`forwardRef` for any reusable primitive** that consumers might need to attach a ref to (Buttons, Inputs, Triggers, anything Radix-compatible). React 19+: `ref` is now a regular prop and `forwardRef` is no longer required — but match the project's React version.
- **Controlled vs uncontrolled:** Decide one or design for both. A `value`-only prop is controlled; a `defaultValue`-only prop is uncontrolled; supporting both means the `useControllableState` pattern.
- **`React.memo` is for measured wins**, not prophylaxis. Use it only when (a) the component is a leaf in a list/table that re-renders often, AND (b) its parent passes stable props (use `useCallback` to stabilize handlers). React 19's compiler removes most cases where you'd reach for it.
- **Children come last in the JSX, top in the props interface.** Use `React.ReactNode` for children 99% of the time — not `JSX.Element` (too narrow) or `ReactElement` (rare).
- **Boolean prop bloat (`isLarge`, `isPrimary`, `withIcon`, …) is a smell.** Use a `variant`/`size` enum (CVA — see `design-system.md`) and composition for the rest.

## Patterns

### Basic component (React 18 style)

```tsx
import { type ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
}
```

### Reusable primitive with `forwardRef` (React 18)

```tsx
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ComponentPropsWithoutRef<'button'>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn('rounded-md px-3 py-2 text-sm', className)}
        {...rest}
      />
    );
  }
);
```

### Same primitive (React 19 — `ref` is a prop)

```tsx
import { type ComponentPropsWithoutRef, type Ref } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ ref, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('rounded-md px-3 py-2 text-sm', className)}
      {...rest}
    />
  );
}
```

### Controlled OR uncontrolled (the both-ways pattern)

```tsx
import { useState } from 'react';

function useControllableState<T>(opts: {
  value?: T;
  defaultValue: T;
  onChange?: (next: T) => void;
}) {
  const [internal, setInternal] = useState(opts.defaultValue);
  const isControlled = opts.value !== undefined;
  const value = isControlled ? (opts.value as T) : internal;
  const setValue = (next: T) => {
    if (!isControlled) setInternal(next);
    opts.onChange?.(next);
  };
  return [value, setValue] as const;
}

interface ToggleProps {
  pressed?: boolean;            // controlled
  defaultPressed?: boolean;     // uncontrolled
  onPressedChange?: (next: boolean) => void;
}

export function Toggle({ pressed, defaultPressed = false, onPressedChange }: ToggleProps) {
  const [isPressed, setPressed] = useControllableState({
    value: pressed,
    defaultValue: defaultPressed,
    onChange: onPressedChange,
  });
  return (
    <button aria-pressed={isPressed} onClick={() => setPressed(!isPressed)}>
      {isPressed ? 'On' : 'Off'}
    </button>
  );
}
```

### Justified `React.memo`

```tsx
import { memo, useCallback } from 'react';

const Row = memo(function Row({ item, onSelect }: { item: Item; onSelect: (id: string) => void }) {
  return <tr onClick={() => onSelect(item.id)}>{/* … */}</tr>;
});

function Table({ items }: { items: Item[] }) {
  // Without useCallback, onSelect would be a new ref each render → memo is wasted.
  const onSelect = useCallback((id: string) => { /* … */ }, []);
  return <tbody>{items.map(i => <Row key={i.id} item={i} onSelect={onSelect} />)}</tbody>;
}
```

## Antipatterns

- **`React.FC<Props>`** — implicit children, no generics, no inference. Type props directly.
- **Everything memoized.** `useMemo`/`useCallback`/`memo` on every line slow renders down (allocation + comparison cost) without measurable gain.
- **Boolean props for variants.** Five booleans = thirty-two states, most invalid. Use a `variant` union.
- **Spreading unknown props onto a DOM element** without typing — silent React DOM warnings and lost type safety.
- **Mutating props.** They're frozen by convention; mutation breaks memoization and re-render assumptions.

## Checklist
- [ ] Functional component, props interface declared (no `React.FC`)
- [ ] Native element props extended via `ComponentPropsWithoutRef` where applicable
- [ ] `forwardRef` (React 18) or ref-as-prop (React 19) for reusable primitives
- [ ] `className` accepted and merged via `cn()` for composability
- [ ] Controlled / uncontrolled story is intentional, not accidental
- [ ] Children typed as `ReactNode`
- [ ] `memo` / `useMemo` / `useCallback` justified by a profiler measurement or a `memo` boundary
- [ ] Component < ~150 lines; sub-components extracted when logic gets crowded
- [ ] Accessible: semantic HTML, ARIA only when semantics aren't enough
