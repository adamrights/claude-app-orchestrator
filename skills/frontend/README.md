# Frontend Skills

<!-- Generated from skills/manifest.yaml by scripts/build-skill-map.mjs. Do not edit by hand: edit the manifest, then run `make skillmap`. -->

| Skill | What it covers | Load when |
|-------|----------------|-----------|
| [`react-component`](react-component.md) | Functional components, forwardRef, controlled/uncontrolled, memo discipline | building any React component, page, or view |
| [`react-hooks`](react-hooks.md) | useState/useEffect/useId/useTransition/useDeferredValue/useSyncExternalStore and custom hooks | writing or extracting hooks; any effect/subscription logic |
| [`state-management`](state-management.md) | Choosing between local state, Context, Zustand, Jotai, Redux Toolkit | state shared across components or persisted across routes |
| [`styling`](styling.md) | CSS Modules, Tailwind, styled-components | any styling work beyond copying existing classes |
| [`routing`](routing.md) | Next.js App Router, React Router, TanStack Router | adding routes, layouts, redirects, or route guards |
| [`error-handling`](error-handling.md) | Error boundaries, try/catch placement, error states | any user-facing failure path or async error surface |
| [`forms`](forms.md) | react-hook-form + Zod, validation, multi-step forms | any form beyond a single uncontrolled input |
| [`accessibility`](accessibility.md) | Semantic HTML, ARIA, keyboard navigation, screen readers | interactive UI work; always alongside design-system work |
| [`server-components`](server-components.md) | Next.js RSC, 'use client' boundaries, Server Actions, streaming Suspense | App Router pages, server/client boundary decisions, Server Actions |
| [`concurrent-react`](concurrent-react.md) | useTransition, useDeferredValue, Suspense as a primitive, useId | laggy interactions, expensive re-renders, suspense-driven loading |
| [`composition-patterns`](composition-patterns.md) | Compound components, polymorphic as, headless UI, slot/asChild | reusable component APIs; anything consumed by other features |
| [`typescript-patterns`](typescript-patterns.md) | Generic components, ComponentPropsWithoutRef, polymorphic refs, discriminated unions | typing component APIs, generics, or complex unions anywhere |
| [`design-system`](design-system.md) | Radix + Tailwind + CVA + shadcn-style primitives, design tokens, theming | building or extending UI primitives; first UI feature of a multi-page app |
| [`animations`](animations.md) | framer-motion (layout, gestures), reduced-motion, CSS vs JS animation | any motion work — transitions, gestures, layout animation |
| [`state-machines`](state-machines.md) | useReducer discriminated unions, XState v5 for complex flows | multi-step flows with distinct states (wizards, uploads, checkout) |
| [`client-persistence`](client-persistence.md) | localStorage/IndexedDB — versioned keys, migrations, validated loads, quota-safe writes | any browser-stored user data; serverless SPAs; offline/draft caching |
| [`optimistic-updates`](optimistic-updates.md) | Instant UI updates with rollback on error | mutations the user should perceive as instant (toggles, likes, reorder) |
| [`data-fetching`](data-fetching.md) | TanStack Query patterns, mutations, invalidation | any client-side server-state fetching or mutation |
| [`data-tables`](data-tables.md) | TanStack Table + Query, URL state, server pagination | sortable/filterable/paginated list UIs |
| [`pagination`](pagination.md) | Cursor vs offset, infinite scroll, URL state | any list too long for one response |
| [`performance`](performance.md) | Code splitting, virtualization, memoization, bundle size, React Compiler | perf work, large lists, heavy bundles, slow renders |
| [`web-vitals`](web-vitals.md) | LCP/INP/CLS, Profiler API, RUM, performance budgets | measuring or fixing Core Web Vitals; perf audits |

Full cross-domain index: [../MAP.md](../MAP.md)
