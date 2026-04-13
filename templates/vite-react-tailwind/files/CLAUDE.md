# Project: {{name}}

## Tech Stack
- **Build tool**: Vite 5
- **Framework**: React 18
- **Language**: TypeScript (strict mode)
- **Routing**: React Router v6
- **Data fetching**: TanStack Query v5
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Lint/Format**: ESLint (flat config) + Prettier
- **Git hooks**: Husky + lint-staged

This is a **client-side SPA** — there is no backend in this project. API calls
go to `env.VITE_API_URL`.

## Commands
- `npm run dev` — start dev server (http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run typecheck` — TypeScript check
- `npm test` — run tests

## Conventions
- Routes defined in `src/router.tsx`
- Components in `src/components/`, pages in `src/pages/`
- Use TanStack Query for all server data — never raw `useEffect` + `fetch`
- Tailwind for styling — no CSS Modules or styled-components
- Use the `@/` path alias for imports from `src/`
- Co-locate tests as `*.test.tsx` next to source files

## Path Alias
- `@/components/Button` → `src/components/Button`

## Environment Variables
All env access goes through the validated module at `src/env.ts`:

```ts
import { env } from '@/env';
const apiUrl = env.VITE_API_URL; // typed, validated, non-null
```

Never read `import.meta.env.*` directly — it bypasses Zod validation and
typing. To add a new var:
1. Prefix it with `VITE_` (Vite only exposes `VITE_*` to client code).
2. Add it to `.env.example`.
3. Add a Zod schema entry under `client` in `src/env.ts`.

Validation runs on app boot, so the page throws loudly if a var is missing
or malformed instead of surfacing a cryptic `undefined` later.

## Error Handling
- `<ErrorBoundary>` (from `@/components/ErrorBoundary`) wraps the router in
  `main.tsx` so any render-time error surfaces a friendly fallback with a
  retry button instead of a blank page.
- Drop additional `<ErrorBoundary>` instances around smaller subtrees
  (widgets, lazy-loaded panes) with a custom `fallback` when you want local
  recovery.
- For **async errors** (fetch failures, mutation errors), TanStack Query
  surfaces them via `query.error` / `mutation.error`. Handle them per-query
  with conditional rendering, or set a global `queryCache` `onError` handler
  in `main.tsx` for toast-style notifications. Do not rely on the React
  error boundary to catch async errors — it doesn't, by design.
- Throwing during render inside a TanStack Query consumer will propagate to
  the nearest `<ErrorBoundary>` (opt in via `throwOnError: true` on the
  query).

## Linting & Formatting
- Flat ESLint config at `eslint.config.mjs` uses `typescript-eslint`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Strict rules:
  no-unused-vars (error), consistent-type-imports (error), no-console (warn).
- Prettier config in `.prettierrc` (singleQuote, trailingComma all, width 100).
- Husky runs `npm run lint && npm run typecheck` on pre-commit. Hooks install
  automatically on `npm install` via the `prepare` script.
- lint-staged (configured in `package.json`) runs Prettier + ESLint --fix on
  staged files only.

## Docker Dev
The Dockerfile is a two-stage build: Node compiles the app, then `nginx:alpine`
serves `dist/` statically. `nginx.conf` sets `try_files $uri $uri/ /index.html`
so client-side routes resolve correctly on reload. Hashed assets under
`/assets/` are served with long-lived `Cache-Control`.

Build and run locally:
```sh
docker build -t {{name}} .
docker run --rm -p 8080:80 {{name}}
```

## Mocking APIs Locally
Since this project has no backend, one of:
- Point `VITE_API_URL` at a real staging API.
- Run a companion `hono-api` (or similar) template in another terminal.
- Use [MSW](https://mswjs.io/) for browser-level request mocking during
  `npm run dev`. Install as a devDependency and register the worker in
  `main.tsx` behind `if (env.DEV)`.

Pick one per project and document it here so Claude agents and new devs know
which path is active.
