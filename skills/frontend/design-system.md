---
tags: [react, design-system, radix, shadcn, cva, tailwind, accessibility, theming]
---

# Design System

## When to use
Any React app with more than a handful of components — even small ones. Once you have two `<Button>`s with slightly different padding, you have an inconsistent design system; you just haven't named it yet. Build a small, opinionated primitive layer early so styling, accessibility, and theming evolve together rather than diverging across the codebase.

## Guidelines

- **Default stack: Radix UI primitives + Tailwind + CVA + shadcn/ui copy-paste pattern.** This is the modern baseline. Don't reach for MUI, Chakra, or Mantine on a new app unless you have a specific reason — they ship a lot of CSS, are hard to theme deeply, and lock you to their component API.
- **Radix primitives for behavior, your code for styles.** Radix gives you accessibility, keyboard handling, focus management, and ARIA wiring for hard components (Dialog, DropdownMenu, Popover, Tooltip, Tabs, Select, RadioGroup, etc.). Never roll your own dialog or combobox — Radix has solved the focus trap, scroll lock, and ESC handling correctly.
- **shadcn/ui pattern: copy primitives into your repo, don't install them.** Use the CLI to scaffold (`npx shadcn@latest add button`), then own the file in `components/ui/`. You get full control to tweak variants, no version lock-in, no breaking changes from upstream. Tradeoff: you maintain them, but they barely change.
- **CVA (class-variance-authority) for variants.** Type-safe, composable, no runtime cost beyond string concatenation. Define variants once per primitive and let consumers compose props. Use `defaultVariants` for sensible defaults.
- **`cn()` utility = `clsx` + `tailwind-merge`.** Always use it when composing Tailwind classes. `tailwind-merge` resolves conflicts (later classes win), so consumers can override `px-4` with `px-6` without the unspecified-order CSS bug.
- **Design tokens live in `tailwind.config.ts` + CSS variables.** Tokens (color, spacing, radius, font sizes) belong in Tailwind's `theme.extend`. For runtime theme switching (light/dark, multi-brand), use CSS variables referenced from Tailwind: `--background: 0 0% 100%` in `:root`, then `colors: { background: 'hsl(var(--background))' }`.
- **Use OKLCH or HSL for theme colors.** Hex codes are opaque and don't interpolate well across themes. OKLCH gives perceptually uniform lightness — invaluable for generating dark-mode variants programmatically. Tailwind v4 supports OKLCH natively.
- **`asChild` pattern with Radix Slot.** Lets primitives compose with arbitrary elements without wrapper divs. `<Button asChild><Link href="/">Home</Link></Button>` renders an `<a>` with all the button styles and props. This is non-negotiable for things like buttons that are sometimes links.
- **Forward refs everywhere.** Radix primitives need refs to wire focus management. Use `React.forwardRef` on every primitive — even ones that don't currently need it, to future-proof composition. (React 19 makes `ref` a normal prop, but the conventions still apply.)
- **Accessibility is a dependency, not a feature.** Visible focus rings via `focus-visible:` (not `:focus`, which fires on click). Color contrast ≥ 4.5:1 for body text. Test with keyboard only — every interactive element must be reachable and operable.
- **Theme switching: `class="dark"` on `<html>` + Tailwind's `dark:` variant.** Use `next-themes` for persistence and SSR-safe hydration. Don't use a runtime theme provider unless you need multi-brand support — CSS variables + a class is faster and simpler.
- **When NOT to roll your own:** if shadcn/ui's primitives cover 90% of what you need, copy them and customize. Building Button/Input/Dialog from scratch when shadcn is one CLI command away is wasted time. Build custom only when your design diverges meaningfully (custom motion language, atypical structure).
- **When NOT to use a design system at all:** truly throwaway prototypes (one-off internal tools that will live for a week). Anything that will exist in 6 months gets a primitive layer.

## Examples

### `cn()` utility

```ts
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### Button with CVA + Radix Slot + forwardRef

```tsx
// components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

// Usage
<Button variant="primary" size="lg">Save</Button>
<Button asChild variant="link"><a href="/docs">Docs</a></Button>
```

### Dialog wrapper around Radix

```tsx
// components/ui/dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
        'rounded-lg border bg-background p-6 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';
```

### Token-based color setup

```css
/* app/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --primary-foreground: 210 40% 98%;
    --ring: 221 83% 53%;
  }
  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --primary: 217 91% 60%;
    --primary-foreground: 222 47% 11%;
    --ring: 217 91% 60%;
  }
}
```

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',
      },
    },
  },
} satisfies Config;
```

## Antipatterns

- **Inline `style={{...}}` for layout or color.** Bypasses your token system. Use Tailwind classes that reference your tokens.
- **`!important` to "fix" specificity.** Use `cn()` + `tailwind-merge` so later classes naturally win.
- **Forking Radix primitives.** Wrap them, don't fork. Radix releases security and a11y fixes regularly.
- **Building your own dialog/select/combobox/tooltip from scratch.** You will get focus trap, escape handling, scroll lock, or ARIA wrong. Use Radix.
- **Multiple ways to render the same primitive.** If `<Button>` and `<a className="btn">` both exist, you've already lost. Centralize.
- **Hard-coded hex colors in components.** `bg-[#3b82f6]` defeats theming. Use token classes.
- **Mixing CSS-in-JS (styled-components, emotion) with Tailwind.** Pick one. Mixing them doubles your styling APIs and confuses the team.

## Checklist
- [ ] All primitives live in `components/ui/` and use `forwardRef`
- [ ] `cn()` utility is used for every dynamic class composition
- [ ] CVA defines variants for any component with more than one visual mode
- [ ] Radix primitives back any component with non-trivial keyboard/focus behavior
- [ ] Colors come from CSS variables, not inline hex codes
- [ ] `:focus-visible` (not `:focus`) drives focus rings
- [ ] Dark mode tested on every primitive
- [ ] `asChild` available on Button/Link-like primitives for composition
- [ ] No design-system component imports from a feature folder (one-way dependency)
