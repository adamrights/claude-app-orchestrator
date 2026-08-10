# Skill Map

<!-- Generated from skills/manifest.yaml by scripts/build-skill-map.mjs. Do not edit by hand: edit the manifest, then run `node scripts/build-skill-map.mjs`. -->

36 skills. Short names are what blueprint `skills:` arrays and agents use; the Layer column drives the orchestrator's splittable-feature detection (only `frontend` and `backend` count toward a layer split).

## backend

| Skill | Layer | What it covers | Load when |
|-------|-------|----------------|-----------|
| [`api-design`](backend/api-design.md) | backend | REST conventions, Next.js and Express patterns | any new API route or endpoint surface |
| [`database`](backend/database.md) | backend | Prisma, Drizzle, schema design | schema changes, queries, transactions, N+1 concerns |
| [`authentication`](backend/authentication.md) | shared | Auth libraries, session management, security | login/logout, sessions, protected routes, OAuth wiring |
| [`trpc`](backend/trpc.md) | backend | Type-safe RPC layer for fullstack TypeScript apps | tRPC routers, procedures, or client integration |
| [`graphql`](backend/graphql.md) | backend | GraphQL conventions, schema design, client patterns | GraphQL schema, resolvers, or client queries |
| [`validation`](backend/validation.md) | shared | Zod schemas, input validation, sanitization | any boundary where external data enters the system |
| [`migrations`](backend/migrations.md) | backend | Prisma and Drizzle migration workflows | schema changes on a database with existing data |
| [`rate-limiting`](backend/rate-limiting.md) | backend | API protection, throttling, 429 responses | public endpoints, auth endpoints, expensive operations |
| [`search`](backend/search.md) | backend | Postgres FTS, Meilisearch, typo tolerance, faceting | any full-text or faceted search feature |
| [`caching`](backend/caching.md) | backend | Redis, HTTP headers, CDN, invalidation strategies | repeated expensive reads; response caching decisions |

## devops

| Skill | Layer | What it covers | Load when |
|-------|-------|----------------|-----------|
| [`docker`](devops/docker.md) | devops | Multi-stage builds, Docker Compose for dev | containerizing the app or adding compose services |
| [`ci-cd`](devops/ci-cd.md) | devops | GitHub Actions for Node.js/Next.js projects | pipeline setup, build/test/deploy workflows |
| [`secrets`](devops/secrets.md) | devops | Env var handling, secret rotation, platform patterns | any new secret, env var, or credential surface |

## frontend

| Skill | Layer | What it covers | Load when |
|-------|-------|----------------|-----------|
| [`react-component`](frontend/react-component.md) | frontend | Functional components, forwardRef, controlled/uncontrolled, memo discipline | building any React component, page, or view |
| [`react-hooks`](frontend/react-hooks.md) | frontend | useState/useEffect/useId/useTransition/useDeferredValue/useSyncExternalStore and custom hooks | writing or extracting hooks; any effect/subscription logic |
| [`state-management`](frontend/state-management.md) | frontend | Choosing between local state, Context, Zustand, Jotai, Redux Toolkit | state shared across components or persisted across routes |
| [`styling`](frontend/styling.md) | frontend | CSS Modules, Tailwind, styled-components | any styling work beyond copying existing classes |
| [`routing`](frontend/routing.md) | frontend | Next.js App Router, React Router, TanStack Router | adding routes, layouts, redirects, or route guards |
| [`error-handling`](frontend/error-handling.md) | frontend | Error boundaries, try/catch placement, error states | any user-facing failure path or async error surface |
| [`forms`](frontend/forms.md) | frontend | react-hook-form + Zod, validation, multi-step forms | any form beyond a single uncontrolled input |
| [`accessibility`](frontend/accessibility.md) | frontend | Semantic HTML, ARIA, keyboard navigation, screen readers | interactive UI work; always alongside design-system work |
| [`server-components`](frontend/server-components.md) | frontend | Next.js RSC, 'use client' boundaries, Server Actions, streaming Suspense | App Router pages, server/client boundary decisions, Server Actions |
| [`concurrent-react`](frontend/concurrent-react.md) | frontend | useTransition, useDeferredValue, Suspense as a primitive, useId | laggy interactions, expensive re-renders, suspense-driven loading |
| [`composition-patterns`](frontend/composition-patterns.md) | frontend | Compound components, polymorphic as, headless UI, slot/asChild | reusable component APIs; anything consumed by other features |
| [`typescript-patterns`](frontend/typescript-patterns.md) | shared | Generic components, ComponentPropsWithoutRef, polymorphic refs, discriminated unions | typing component APIs, generics, or complex unions anywhere |
| [`design-system`](frontend/design-system.md) | frontend | Radix + Tailwind + CVA + shadcn-style primitives, design tokens, theming | building or extending UI primitives; first UI feature of a multi-page app |
| [`animations`](frontend/animations.md) | frontend | framer-motion (layout, gestures), reduced-motion, CSS vs JS animation | any motion work — transitions, gestures, layout animation |
| [`state-machines`](frontend/state-machines.md) | shared | useReducer discriminated unions, XState v5 for complex flows | multi-step flows with distinct states (wizards, uploads, checkout) |
| [`optimistic-updates`](frontend/optimistic-updates.md) | frontend | Instant UI updates with rollback on error | mutations the user should perceive as instant (toggles, likes, reorder) |
| [`data-fetching`](frontend/data-fetching.md) | frontend | TanStack Query patterns, mutations, invalidation | any client-side server-state fetching or mutation |
| [`data-tables`](frontend/data-tables.md) | frontend | TanStack Table + Query, URL state, server pagination | sortable/filterable/paginated list UIs |
| [`pagination`](frontend/pagination.md) | frontend | Cursor vs offset, infinite scroll, URL state | any list too long for one response |
| [`performance`](frontend/performance.md) | frontend | Code splitting, virtualization, memoization, bundle size, React Compiler | perf work, large lists, heavy bundles, slow renders |
| [`web-vitals`](frontend/web-vitals.md) | frontend | LCP/INP/CLS, Profiler API, RUM, performance budgets | measuring or fixing Core Web Vitals; perf audits |

## testing

| Skill | Layer | What it covers | Load when |
|-------|-------|----------------|-----------|
| [`react-testing`](testing/react-testing.md) | testing | Vitest, React Testing Library, MSW | component/hook/integration tests |
| [`e2e-testing`](testing/e2e-testing.md) | testing | Playwright setup and patterns | end-to-end user-flow tests |
