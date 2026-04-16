---
tags: [react, composition, compound-components, polymorphic, headless, slot, controlled-uncontrolled, radix, design-system]
---

# Composition Patterns

## When to use
Whenever you build a reusable component that more than one feature will consume — design system primitives, shared layout components, anything you'd publish to an internal package. The difference between a component people love and one they fight is almost always the API. Reach for composition before you reach for more props.

## Guidelines

- **Composition beats configuration.** A flexible component has *few* props and *good slots*. Every new boolean prop is a future merge conflict in someone's design intent. Look at Radix UI, React Aria, and Headless UI as the canonical examples — none of them have a `size="lg"` prop on a primitive.
- **Compound components** for parts that coordinate. `<Tabs><Tabs.List><Tabs.Trigger /></Tabs.List><Tabs.Panel /></Tabs>` keeps state in the parent (Context), and children consume it implicitly. Use for Tabs, Accordion, Select, Dialog, Menu, Toolbar — anything with multiple coordinated parts.
- **Polymorphic components with `as`.** `<Box as="a" href="...">` lets a single component render different elements while preserving correct typing. Useful for layout primitives (`Box`, `Text`, `Stack`) and headings. The TypeScript is gnarly — write the helper once, reuse it.
- **Headless components** for behavior + accessibility without markup. Radix Primitives, React Aria, Headless UI, TanStack Table — all give you state, keyboard handling, ARIA, focus management; you bring the JSX and CSS. Default to headless libraries for anything with non-trivial a11y (combobox, listbox, dialog, menu).
- **The Slot pattern (`asChild`).** Radix's `Slot` lets a parent merge its props/refs onto an arbitrary child element. `<Tooltip.Trigger asChild><MyButton /></Tooltip.Trigger>` — the tooltip's behavior wraps your existing button instead of forcing you to nest one. Critical when composing primitives that each want to "be" the interactive element.
- **Controlled vs uncontrolled — support both.** Accept `value` + `onChange` (controlled) *or* `defaultValue` (uncontrolled). The `useControllableState` pattern (or Radix's `useControllableState` hook) handles the switch. Forcing controlled-only makes simple use cases verbose; forcing uncontrolled-only blocks integration with form libraries.
- **Render props / function-as-children** are rare in modern React but still useful when you need tightly-coupled rendering customization that hooks can't express — e.g., TanStack Table's `flexRender`, TanStack Virtual. Don't reach for them when a hook + JSX would do.
- **`forwardRef` (or React 19's ref-as-prop) for every primitive.** Anything that renders a real DOM element should accept a ref so consumers can integrate with focus libraries, animation libraries (Framer Motion), and DOM measurement. In React 19+, `ref` is just a prop on function components — `forwardRef` is no longer required, though existing code still works.
- **Variants belong in a variant system, not in a sea of booleans.** Use `class-variance-authority` (CVA) or Tailwind Variants. `<Button variant="primary" size="md">` is one prop with strict TS unions; `<Button isPrimary isLarge withIcon>` is a combinatorial mess.

### When NOT to use these

- **Compound components for two-element APIs.** `<Card>` + `<CardHeader>` is fine, but if there's only ever one variant, just take a `header` prop.
- **Polymorphic `as` on leaf components.** A `<Button>` should be a `<button>`. Polymorphism belongs on primitives like `<Box>`, `<Text>`, `<Link>` — not on every component.
- **Headless libraries for trivial widgets.** A custom toggle that's just `<button aria-pressed>` doesn't need React Aria. Use headless libraries when accessibility is hard (combobox, dialog, menu, date picker).
- **`asChild` everywhere.** It's powerful but indirect — overuse makes the render tree hard to reason about. Reach for it when you're composing two interactive primitives, not as a default.

## Examples

### Compound `<Tabs>` with Context

```tsx
import { createContext, useContext, useId, useState, type ReactNode } from 'react';

type TabsCtx = { value: string; setValue: (v: string) => void; baseId: string };
const TabsContext = createContext<TabsCtx | null>(null);
const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
};

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
}

export function Tabs({ defaultValue, value, onValueChange, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const setValue = (v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value: current, setValue, baseId }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.List = function TabsList({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
};

Tabs.Trigger = function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { value: current, setValue, baseId } = useTabs();
  const selected = current === value;
  return (
    <button
      role="tab"
      id={`${baseId}-trigger-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabsPanel({ value, children }: { value: string; children: ReactNode }) {
  const { value: current, baseId } = useTabs();
  if (current !== value) return null;
  return (
    <div role="tabpanel" id={`${baseId}-panel-${value}`} aria-labelledby={`${baseId}-trigger-${value}`}>
      {children}
    </div>
  );
};
```

### Polymorphic `<Box as="...">` with proper typing

```tsx
import { type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type BoxOwnProps<C extends ElementType> = {
  as?: C;
  children?: ReactNode;
};

type BoxProps<C extends ElementType> = BoxOwnProps<C> &
  Omit<ComponentPropsWithoutRef<C>, keyof BoxOwnProps<C>>;

export function Box<C extends ElementType = 'div'>({ as, children, ...rest }: BoxProps<C>) {
  const Component = (as ?? 'div') as ElementType;
  return <Component {...rest}>{children}</Component>;
}

// Usage — TS knows about `href` because as="a"
<Box as="a" href="/docs">Docs</Box>;
// And rejects href when as="div"
// <Box as="div" href="/docs" /> // ❌ TS error
```

### `Slot` / `asChild` button (Radix-style)

```tsx
import { Slot } from '@radix-ui/react-slot';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild, className, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={`btn ${className ?? ''}`} {...rest} />;
});

// Usage — render the button styles on a Next.js Link, no <a> nested in <button>
import Link from 'next/link';
<Button asChild>
  <Link href="/signup">Sign up</Link>
</Button>;
```

### Controlled / uncontrolled Toggle with `useControllableState`

```tsx
import { useCallback, useState } from 'react';

function useControllableState<T>(opts: {
  value: T | undefined;
  defaultValue: T;
  onChange?: (v: T) => void;
}): [T, (v: T) => void] {
  const { value, defaultValue, onChange } = opts;
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const set = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [current, set];
}

interface ToggleProps {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  children: React.ReactNode;
}

export function Toggle({ pressed, defaultPressed = false, onPressedChange, children }: ToggleProps) {
  const [on, setOn] = useControllableState({
    value: pressed,
    defaultValue: defaultPressed,
    onChange: onPressedChange,
  });
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn(!on)}>
      {children}
    </button>
  );
}
```

## Antipatterns

- **30 boolean props on one component.** `<Button isPrimary isLarge withIcon iconRight isLoading isDisabled isFullWidth>` — every combination is untestable. Use a `variant` enum + `size` enum (CVA) and slot the icon as a child or named prop.
- **Forcing consumers to wrap your component to add an `onClick`.** If your primitive doesn't forward refs and spread the rest of its props, every consumer ends up with a wrapper div. Always spread `...rest` onto the underlying element and forward `ref`.
- **Compound components without a Context guard.** If `<Tabs.Trigger>` is rendered outside `<Tabs>`, fail loudly with an error message that names the component. Silent context-default behavior leads to debugging nightmares.
- **Polymorphic components without `Omit`.** Without `Omit<ComponentPropsWithoutRef<C>, keyof OwnProps>`, your own props collide with the underlying element's props (e.g., a `color` prop conflicts with HTML `color`). The TS errors are confusing.
- **Re-implementing a combobox/menu/dialog from scratch.** You will get the keyboard handling, focus trap, ARIA roles, and screen reader semantics wrong. Use Radix or React Aria.
- **Mixing controlled and uncontrolled in the same render.** Switching `value` from `undefined` to a string mid-life triggers React's controlled/uncontrolled warning. Pick one at mount and stay there — `useControllableState` enforces this.

## Checklist

- [ ] Reusable primitives forward `ref` and spread remaining props onto the underlying element
- [ ] Coordinated multi-part components use a compound API with Context (with a guard hook)
- [ ] Layout primitives (`Box`, `Text`, `Stack`) are polymorphic via `as` with proper TS typing
- [ ] Accessibility-heavy widgets are built on Radix / React Aria / Headless UI, not from scratch
- [ ] Variants are expressed via CVA or a typed enum, not a forest of booleans
- [ ] Components that hold state support both controlled and uncontrolled modes
- [ ] `asChild` (Slot) is offered for primitives that may need to merge with another interactive element
- [ ] No component renders a Radix/headless primitive without checking the library's recipe first
