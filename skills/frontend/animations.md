---
tags: [react, animations, framer-motion, css-transitions, tailwind, accessibility, performance]
---

# Animations

## When to use
Whenever a UI state change benefits from being communicated visually — hover affordances, modal entrances, list reordering, route transitions, drag interactions. Animation is communication, not decoration. Default to CSS for state-driven micro-interactions; reach for framer-motion when you need layout animations, exit animations, gestures, or choreography.

## Guidelines

- **Mental model: CSS for state, JS for choreography.** CSS transitions handle hover/focus/checked/open state changes cheaply and declaratively. JavaScript animation libraries (framer-motion is the default in React) earn their keep for: shared-layout transitions, exit animations, gesture-driven motion, scroll-linked effects, and physics-based springs.
- **Tailwind's `transition-*`, `duration-*`, `ease-*` utilities are the first reach.** They compose with `hover:`, `focus-visible:`, `data-[state=open]:`, etc. — covering ~80% of UI motion with no JS cost.
- **Animate `transform` and `opacity` only.** These are GPU-composited and don't trigger layout. Avoid animating `width`, `height`, `top`, `left`, `margin` — they cause layout thrash and jank, especially on lower-end devices. If you need a size animation, use `transform: scale()` or framer-motion's `layout` prop.
- **Respect `prefers-reduced-motion` everywhere.** Vestibular disorders are real; OS-level motion preferences are not optional. In CSS, gate motion behind `@media (prefers-reduced-motion: no-preference)` or use Tailwind's `motion-safe:` and `motion-reduce:` variants. In framer-motion, use `useReducedMotion()` to swap to instant transitions.
- **framer-motion is for things CSS can't do well:** `AnimatePresence` for exit animations (CSS has no notion of "about to unmount"), `layoutId` for shared-element transitions across components, `useScroll`/`useTransform` for scroll-linked effects, drag with momentum, orchestrated stagger.
- **`layout` prop = automatic FLIP.** When a component changes size/position due to a state change, `<motion.div layout>` animates between the old and new positions using the FLIP technique. Massively reduces hand-rolled animation code.
- **View Transitions API is the emerging native alternative.** Browser-native cross-document and same-document transitions. Next.js App Router exposes `unstable_ViewTransition` (still evolving — check current status before relying on it). Use it for page-to-page transitions; framer-motion's `layoutId` for in-page shared elements.
- **Use spring physics for natural motion.** Linear timing functions feel mechanical. framer-motion's default `spring` config feels right for most UI. For CSS, `cubic-bezier(0.16, 1, 0.3, 1)` (the "ease-out-expo" curve) is a good default for entrances.
- **Stagger lists, but bounded.** A 50ms stagger across 8 items is delightful; across 80 items it's tedious. Cap stagger duration regardless of list length.
- **`will-change` sparingly, and only just before animation starts.** Permanent `will-change` allocates compositor layers and burns memory. Add it on hover/focus, remove after animation.
- **When NOT to animate:** form inputs while typing (motion competes with the user), data tables (people scan, they don't want bouncing rows), anywhere the animation delays the user from completing a task. Animations should never gate interaction — make them interruptible.
- **When NOT to reach for framer-motion:** hover/focus state changes, simple fade/slide entrances on mount (`@starting-style` or Tailwind's `animate-in` from `tailwindcss-animate` is enough). Don't pull in 30KB for a fade.

## Examples

### Tailwind hover transition with reduced-motion fallback

```tsx
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        'rounded-lg border p-6 ' +
        'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out ' +
        'motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg'
      }
    >
      {children}
    </div>
  );
}
```

### AnimatePresence with stagger

```tsx
import { AnimatePresence, motion } from 'framer-motion';

interface Item { id: string; label: string }

export function StaggeredList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{
              duration: 0.2,
              delay: Math.min(i * 0.04, 0.3), // cap total stagger
            }}
            className="rounded border p-3"
          >
            {item.label}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
```

### Shared layout with `layoutId`

```tsx
import { motion } from 'framer-motion';
import { useState } from 'react';

export function ExpandableCard({ id, title, body }: { id: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <motion.button
          layoutId={`card-${id}`}
          onClick={() => setOpen(true)}
          className="rounded-lg border p-4"
        >
          <motion.h3 layoutId={`title-${id}`}>{title}</motion.h3>
        </motion.button>
      )}
      {open && (
        <motion.div
          layoutId={`card-${id}`}
          className="fixed inset-8 z-50 rounded-lg border bg-background p-8"
        >
          <motion.h3 layoutId={`title-${id}`}>{title}</motion.h3>
          <p className="mt-4">{body}</p>
          <button onClick={() => setOpen(false)}>Close</button>
        </motion.div>
      )}
    </>
  );
}
```

### Reduced-motion-aware framer transition

```tsx
import { motion, useReducedMotion } from 'framer-motion';

export function FadeIn({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}
```

### Draggable card with constraints

```tsx
import { motion } from 'framer-motion';
import { useRef } from 'react';

export function DraggableCard({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="relative h-96 w-full border">
      <motion.div
        drag
        dragConstraints={containerRef}
        dragElastic={0.2}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        className="absolute h-32 w-32 cursor-grab rounded bg-primary p-4 text-primary-foreground"
      >
        {children}
      </motion.div>
    </div>
  );
}
```

## Antipatterns

- **Animating `width`/`height`/`top`/`left`** — use `transform` instead. Animating layout properties triggers reflow on every frame.
- **Long animations gating UX.** A 600ms modal entrance feels luxurious in design review and slow in production. Keep micro-interactions ≤ 200ms, transitions ≤ 400ms.
- **Ignoring `prefers-reduced-motion`.** Causing motion sickness is a real accessibility failure.
- **Using framer-motion for hover states.** Wasted bundle weight. CSS does this for free.
- **Permanent `will-change`.** Allocates compositor layers indefinitely.
- **Animating during hydration.** Initial-mount entrance animations on every page load become noise. Save motion for state changes the user actually causes.

## Checklist
- [ ] Animations use `transform`/`opacity`, not layout properties
- [ ] `prefers-reduced-motion` honored (CSS variant or `useReducedMotion`)
- [ ] Hover/focus transitions use Tailwind/CSS, not framer-motion
- [ ] Exit animations use `AnimatePresence` (CSS can't do them)
- [ ] Stagger durations capped regardless of list length
- [ ] Animation durations ≤ 400ms; micro-interactions ≤ 200ms
- [ ] Motion never blocks user interaction (interruptible, skippable)
- [ ] No `will-change` left on idle elements
