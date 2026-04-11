# Project: {{name}}

## Tech Stack
- **Build tool**: Vite 5
- **Framework**: React 18
- **Language**: TypeScript (strict mode)
- **Routing**: React Router v6
- **Data fetching**: TanStack Query v5
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

This is a **client-side SPA** — there is no backend in this project. API calls go to `VITE_API_URL`.

## Commands
- `npm run dev` — start dev server (http://localhost:5173)
- `npm run build` — production build
- `npm run preview` — preview production build
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
