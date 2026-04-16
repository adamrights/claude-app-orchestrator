---
tags: [react, typescript, types, generics, forwardRef, polymorphic, discriminated-union, satisfies, strict-mode]
---

# TypeScript Patterns for React

## When to use
Every React + TypeScript project. The types you give a component *are* its API — bad types make a component painful to consume even if it works at runtime. This skill covers the patterns that separate a typed-but-frustrating component from one that's a pleasure to use: extending native props correctly, generic components, polymorphism, discriminated unions, and the Strict-mode boundaries.

## Guidelines

- **Extend native element props with `ComponentPropsWithoutRef<'tag'>`.** Don't extend `HTMLAttributes<HTMLButtonElement>` (misses `type`, `disabled`, `form`, etc.) and don't manually list event handlers. `ComponentPropsWithoutRef<'button'>` includes everything React types for a `<button>`. Use `ComponentPropsWithRef<'button'>` only when you really want `ref` in the prop type.
- **`forwardRef` with generics is awkward** — TypeScript collapses the generic when wrapped in `forwardRef`. Workarounds: cast the result, use a helper, or *use React 19's ref-as-prop* and skip `forwardRef` entirely. In React 19, `ref` is just a regular prop on function components.
- **Polymorphic typing is the gnarliest pattern in React TS.** It needs `ElementType`, `ComponentPropsWithoutRef<C>`, and `Omit` to remove conflicting keys. Write the utility once (or import from `@radix-ui/react-polymorphic`, `react-polymorphic-types`) — don't re-derive it per component.
- **Discriminated union props beat optional everything.** `type Props = { variant: 'link'; href: string } | { variant: 'button'; onClick: () => void }` lets TS narrow the props by `variant` at the call site. The alternative — `{ variant; href?; onClick? }` — pushes runtime guards into every consumer.
- **`satisfies` over `as` (and over explicit annotations) when you want both inference and a constraint.** `const config = { ... } satisfies Config` keeps the literal types narrow *and* checks against `Config`. Annotating with `: Config` widens to `Config`; `as Config` skips the check entirely.
- **`as const` for variant maps and tuple-shaped data.** Narrows literal types so they can drive union types elsewhere. Pair with `keyof typeof X` to derive a union of keys.
- **Use the `*Handler` aliases for event handler props.** `React.MouseEventHandler<HTMLButtonElement>` is shorter and clearer than `(e: React.MouseEvent<HTMLButtonElement>) => void` — and they're identical types.
- **`ReactNode` for `children` — almost always.** It accepts strings, numbers, booleans, null, arrays, fragments, portals, and elements. Use `ReactElement` only when you specifically need to clone or pass an element (rare). Avoid `JSX.Element` in component props — it's narrower than what JSX expressions return.
- **Strict mode is non-negotiable.** Enable `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true` for new projects. The cost is upfront; the bug catch rate is enormous.
- **`unknown` at I/O boundaries, never `any`.** Anything coming from `fetch`, `localStorage`, `postMessage`, query params — type as `unknown` and validate with Zod (see the `validation` skill). `any` silently disables type checking through your entire codebase.
- **Skip `React.FC`.** It implicitly adds `children?: ReactNode` (often wrong), doesn't support generic components, and has no value over a plain function declaration with typed props. The React team itself moved away from it.
- **Inferred return types on components.** Don't annotate the return type of a function component; let TS infer it. Annotating with `JSX.Element` rejects `null`/`false` returns; annotating with `ReactNode` is too wide and breaks consumers expecting an element.

### When NOT to use these

- **Don't reach for generics on a component that has one consumer.** `<Select<T>>` is great for a shared primitive; for a one-off form field, keep it concrete.
- **Don't type a component polymorphically because it *could* render different elements.** If 99% of usage is `<Button>`, ship a `<Button>` and a separate `<LinkButton>`. Polymorphism is for true primitives.
- **Don't push everything through Zod.** Internal data that's already typed by your DB client / RPC client doesn't need re-validation. Validate at the *external* edge (network, storage, user input).

## Examples

### Typed `<Button>` extending the native element

```tsx
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} disabled={disabled || loading} data-variant={variant} {...rest}>
      {loading ? '…' : children}
    </button>
  );
});
```

### Generic `<Select<T>>` (with the React 18 forwardRef workaround)

```tsx
import { type ReactNode, forwardRef, type Ref } from 'react';

interface SelectProps<T> {
  options: ReadonlyArray<T>;
  getKey: (option: T) => string;
  getLabel: (option: T) => string;
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: ReactNode;
}

function SelectInner<T>(
  { options, getKey, getLabel, value, onChange, placeholder }: SelectProps<T>,
  ref: Ref<HTMLSelectElement>,
) {
  return (
    <select
      ref={ref}
      value={value ? getKey(value) : ''}
      onChange={(e) => {
        const next = options.find((o) => getKey(o) === e.target.value);
        if (next) onChange(next);
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={getKey(o)} value={getKey(o)}>
          {getLabel(o)}
        </option>
      ))}
    </select>
  );
}

// Cast preserves the generic through forwardRef
export const Select = forwardRef(SelectInner) as <T>(
  props: SelectProps<T> & { ref?: Ref<HTMLSelectElement> },
) => ReturnType<typeof SelectInner>;
```

In **React 19**, the workaround disappears — `ref` is just a prop:

```tsx
interface SelectProps<T> {
  // ...same as above
  ref?: Ref<HTMLSelectElement>;
}

export function Select<T>({ options, getKey, getLabel, value, onChange, ref }: SelectProps<T>) {
  // body unchanged
}
```

### Polymorphic `<Text as="...">` with proper typing

```tsx
import { type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type TextOwnProps<C extends ElementType> = {
  as?: C;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
};

type TextProps<C extends ElementType> = TextOwnProps<C> &
  Omit<ComponentPropsWithoutRef<C>, keyof TextOwnProps<C>>;

export function Text<C extends ElementType = 'p'>({ as, size = 'md', children, ...rest }: TextProps<C>) {
  const Component = (as ?? 'p') as ElementType;
  return (
    <Component data-size={size} {...rest}>
      {children}
    </Component>
  );
}

// TS knows: `htmlFor` only valid when as="label"; `href` only valid when as="a"
<Text as="label" htmlFor="email" size="sm">Email</Text>;
<Text as="a" href="/docs">Docs</Text>;
```

### Discriminated union `<Link>` (internal vs external)

```tsx
import NextLink from 'next/link';
import { type ReactNode } from 'react';

type LinkProps =
  | { kind: 'internal'; href: string; children: ReactNode }
  | { kind: 'external'; href: string; children: ReactNode; download?: boolean };

export function Link(props: LinkProps) {
  if (props.kind === 'internal') {
    return <NextLink href={props.href}>{props.children}</NextLink>;
  }
  // TS narrowed to the external variant — `download` is available here
  return (
    <a href={props.href} target="_blank" rel="noreferrer noopener" download={props.download}>
      {props.children}
    </a>
  );
}
```

### `satisfies` for a typed config without widening

```ts
type RouteConfig = Record<string, { path: string; auth: boolean }>;

const routes = {
  home: { path: '/', auth: false },
  dashboard: { path: '/dashboard', auth: true },
} satisfies RouteConfig;

// `satisfies` keeps literal keys: 'home' | 'dashboard'
type RouteName = keyof typeof routes; // 'home' | 'dashboard'

// vs annotating: `const routes: RouteConfig = { ... }` would widen RouteName to `string`.
```

### `as const` + `keyof typeof` for variant unions

```ts
const sizeMap = {
  sm: '0.75rem',
  md: '1rem',
  lg: '1.25rem',
} as const;

export type Size = keyof typeof sizeMap; // 'sm' | 'md' | 'lg'

export function getSize(s: Size) {
  return sizeMap[s]; // typed as '0.75rem' | '1rem' | '1.25rem'
}
```

### Validating an unknown boundary value

```ts
import { z } from 'zod';

const StoredUser = z.object({ id: z.string(), name: z.string() });
type StoredUser = z.infer<typeof StoredUser>;

export function loadUser(): StoredUser | null {
  const raw: unknown = JSON.parse(localStorage.getItem('user') ?? 'null');
  const parsed = StoredUser.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
```

## Antipatterns

- **`React.FC<Props>`.** Implicit `children`, no generics, no value over `function Component(props: Props)`. The community and the React team have moved on.
- **`extends HTMLAttributes<HTMLButtonElement>`.** Missing `type`, `disabled`, `form`, `name`, `value`, `formAction`. Use `ComponentPropsWithoutRef<'button'>`.
- **`as Foo` to silence type errors.** A type assertion is a *promise* to TS that you know better. Use `satisfies` or fix the underlying type. Reserve `as` for genuine narrowings the compiler can't infer (e.g., `event.target as HTMLInputElement`).
- **`any` on `unknown` data.** `JSON.parse` returns `any`; `event.target` is `EventTarget`. Type as `unknown`, then validate with Zod or narrow with `instanceof`.
- **Optional everything for variants.** `{ href?: string; onClick?: () => void }` forces every consumer to handle the impossible state. Use a discriminated union.
- **Annotating component return types.** `function Foo(): JSX.Element` rejects `return null`. Let inference handle it.
- **`children: JSX.Element`.** Rejects `'hello'`, `null`, arrays, fragments. Use `ReactNode`.
- **`React.MouseEvent` on a prop without specifying the element.** `(e: React.MouseEvent) => void` loses `e.currentTarget` typing. Always parameterize: `React.MouseEvent<HTMLButtonElement>`.

## Checklist

- [ ] `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] Components extending native elements use `ComponentPropsWithoutRef<'tag'>`
- [ ] No `React.FC` in the codebase
- [ ] Generic components either use the React 19 ref-as-prop pattern or the typed-`forwardRef` cast
- [ ] Polymorphic components use a single shared utility type, not bespoke per-component typings
- [ ] Mutually exclusive props use a discriminated union, not optional fields
- [ ] External data (`fetch`, `localStorage`, query params) is typed `unknown` and validated with Zod
- [ ] Config objects use `satisfies` to keep literal types
- [ ] No `any` outside of well-commented escape hatches
- [ ] Component return types are inferred, not annotated
