# Authoring Blueprints

A blueprint is a declarative spec that tells the orchestrator what to build. Good blueprints produce good apps; vague blueprints produce vague apps. This guide covers what to include and how to phrase it.

See [blueprints/schema.md](../blueprints/schema.md) for the formal field reference.

## Start from an example

Always copy an example blueprint and edit it. Don't write one from scratch — the examples encode the right shape and field order:

- `blueprints/examples/todo-app.yaml` — fullstack app with auth + DB
- `blueprints/examples/dashboard-spa.yaml` — client-side SPA with no DB
- `blueprints/examples/notes-api.yaml` — standalone API

## Picking the right `stack.type`

| You want… | Use |
|-----------|-----|
| A fullstack web app with database, auth, and UI in one project | `fullstack` |
| A client-side SPA that talks to an existing backend | `spa` |
| A standalone API with no UI | `api` |

If unsure, default to `fullstack` — it's the most common.

## Writing good `features`

Features are the most important field. Each feature becomes a git commit and a unit of work for a specialist agent. Guidelines:

- **Order matters**. Put features in dependency order: API before UI that consumes it; auth before features that require login.
- **Keep features focused**. One CRUD resource per feature is a good rule of thumb. If a feature description has more than one "and", consider splitting it.
- **Be specific in descriptions**. "Build a dashboard" is too vague. "Dashboard page that shows 4 metric cards (revenue, users, orders, conversion) and a line chart of revenue over the last 30 days" is much better.
- **Pick the right skills**. The `skills` array tells the orchestrator which knowledge files to load. Be generous — including an extra skill costs nothing.

### Skill picking cheat sheet

| Building… | Skills to include |
|-----------|-------------------|
| A REST API endpoint | `api-design`, `database` |
| A React UI page or component | `react-component`, `styling` |
| Stateful UI (forms, filters) | `react-component`, `react-hooks`, `state-management` |
| URL-driven state | `routing`, `state-management` |
| Auth flows | `authentication`, `react-hooks` |
| Tests | `react-testing` (component) or `e2e-testing` (browser) |

## Writing good `models`

Use the simplified Prisma-like syntax. Common patterns:

```yaml
models:
  Post:
    fields:
      id: cuid                                 # Always use cuid for primary keys
      title: string                            # Required
      slug: string @unique                     # Unique constraint
      excerpt: string?                         # Optional
      published: boolean @default(false)       # Default value
      author: User @relation                   # Many-to-one
      tags: PostTag[]                          # Many-to-many via join table
      createdAt: datetime @default(now())
```

For many-to-many, define an explicit join model (the orchestrator generates the right Prisma/Drizzle relation):

```yaml
PostTag:
  fields:
    id: cuid
    post: Post @relation
    tag: Tag @relation
```

## Writing good `pages`

Pages are mostly relevant for `fullstack` and `spa` types. Each page should describe:
- The URL path
- Whether it requires auth
- What the user sees and can do (the `features` bullet list)

Keep page-level features short — they're hints to the orchestrator, not specs. The detailed work happens in the top-level `features` array.

## Common mistakes

- **Too many features at once**: A blueprint with 30 features will exhaust context. Split into multiple smaller blueprints, build them one at a time.
- **Vague descriptions**: "Make it nice" is not actionable. Describe behavior, not aesthetics.
- **Forgetting auth dependencies**: If your dashboard needs login, the `auth` feature must come before the `dashboard-ui` feature in the list.
- **Inventing fields the template doesn't support**: Stick to the documented field types. Custom field types or annotations will be ignored.
