# Project: {{name}}

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library

## Commands
- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
- `npm test` — run tests
- `npm run db:push` — sync Prisma schema to database
- `npm run db:studio` — browse data in Prisma Studio

## Conventions
- Components live in `src/components/`, pages in `src/app/`
- API routes in `src/app/api/{resource}/route.ts`
- Prisma client at `src/lib/prisma.ts` — always import from there, never `new PrismaClient()` in handlers
- Validate all API input with Zod schemas at the route boundary
- Co-locate tests as `*.test.tsx` next to source files
- Use the `@/` path alias for imports from `src/`
- Tailwind for styling — no CSS Modules or styled-components

## Path Alias
- `@/components/Button` → `src/components/Button`
