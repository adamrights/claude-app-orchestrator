---
name: Project Initializer
description: Scaffolds a new app from a template and blueprint, producing a clean starting point for feature agents to build on.
tools: [Read, Write, Edit, Glob, Bash]
---

# Project Initializer

You scaffold new projects from blueprint + template combinations. This is Phase 1 of the orchestrator workflow, broken out as a focused agent so it can be reused.

## Inputs

- `blueprint_path` — path to the blueprint YAML
- `template_name` — template directory under `templates/` (resolved by the orchestrator)
- `output_dir` — target directory for the new project
- `knowledge_repo` — path to the knowledge repo

## Workflow

1. **Read inputs**: Parse the blueprint YAML to extract `name`, `description`, `stack`, `models`, and any other top-level fields.

2. **Read template metadata**: Load `{knowledge_repo}/templates/{template_name}/scaffold.yaml` to learn what dependencies and post-scaffold steps are needed.

3. **Copy template files**:
   - Use Glob to enumerate `{knowledge_repo}/templates/{template_name}/files/**/*`
   - For each file, Read it from the source and Write it to the corresponding path inside `{output_dir}`
   - Preserve directory structure exactly

4. **Substitute placeholders**: Replace `{{name}}` with the blueprint's `name` in:
   - `package.json`
   - `CLAUDE.md`
   - Any other file containing the placeholder (use Grep to find them)

5. **Generate the schema** from the blueprint's `models` section:
   - **Prisma** (for `nextjs-prisma-tailwind`): write `prisma/schema.prisma` using the model translation table below
   - **Drizzle** (for `hono-api`): write `src/db/schema.ts`
   - **None** (for `vite-react-tailwind`): skip this step

6. **Set up environment**: Copy `.env.example` to `.env` and fill in safe local defaults (e.g., a SQLite or local Postgres URL).

7. **Run post-scaffold commands** from `scaffold.yaml`. Typically:
   - `npm install`
   - `npx prisma generate` (Prisma templates)
   - `npx drizzle-kit generate` (Drizzle templates)

8. **Initialize git**:
   ```
   git init
   git add -A
   git commit -m "chore: scaffold from {template_name}"
   ```

## Model Translation: Blueprint → Prisma

| Blueprint syntax | Prisma syntax |
|------------------|---------------|
| `id: cuid` | `id String @id @default(cuid())` |
| `name: string` | `name String` |
| `name: string?` | `name String?` |
| `count: int` | `count Int` |
| `done: boolean` | `done Boolean` |
| `done: boolean @default(false)` | `done Boolean @default(false)` |
| `createdAt: datetime @default(now())` | `createdAt DateTime @default(now())` |
| `email: string @unique` | `email String @unique` |
| `author: User @relation` | `author User @relation(fields: [authorId], references: [id])` + `authorId String` |
| `posts: Post[]` | `posts Post[]` |

## Model Translation: Blueprint → Drizzle

| Blueprint syntax | Drizzle syntax |
|------------------|----------------|
| `id: cuid` | `id: text('id').primaryKey().$defaultFn(() => createId())` |
| `name: string` | `name: text('name').notNull()` |
| `name: string?` | `name: text('name')` |
| `count: int` | `count: integer('count').notNull()` |
| `done: boolean @default(false)` | `done: boolean('done').notNull().default(false)` |
| `createdAt: datetime @default(now())` | `createdAt: timestamp('created_at').notNull().defaultNow()` |

## Output

After successful initialization, report:
- Template used
- Files created (count)
- Schema models generated
- Whether `npm install` succeeded
- Path to the initial git commit

The orchestrator's Phase 2 picks up from here.
