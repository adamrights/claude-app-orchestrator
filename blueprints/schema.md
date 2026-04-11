# Blueprint Schema

A blueprint is a YAML file with the following top-level fields.

## Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Project name (used for package.json, directory, CLAUDE.md) |
| `description` | string | yes | One-line summary |
| `stack` | object | no | Drives template inference |
| `template` | string | no | Explicit template name (overrides `stack`-based inference) |
| `execution` | string | no | `auto` (default), `parallel`, or `sequential` — controls parallel execution |
| `models` | object | no | Database models, keyed by model name |
| `pages` | array | no | UI routes (ignored for `type: api`) |
| `features` | array | yes | Buildable units, processed in declaration order (with parallelism if enabled) |

## `execution`

Controls how the orchestrator runs features:

| Value | Behavior |
|-------|----------|
| `auto` (default) | Orchestrator infers dependencies and runs in parallel if the blueprint passes safety checks; falls back to sequential otherwise |
| `parallel` | Always runs in parallel mode, skipping safety checks. Use only if you know the dependency graph is clean. |
| `sequential` | Always runs one feature at a time. Slower but predictable. |

See [guides/parallel-execution.md](../guides/parallel-execution.md) for the full inference rules and safety checks.

## `stack`

| Field | Values | Default | Notes |
|-------|--------|---------|-------|
| `type` | `fullstack` \| `spa` \| `api` | `fullstack` | Determines which template is selected |
| `database` | `postgres` \| `sqlite` | `postgres` | Only for `fullstack` and `api` |
| `auth` | `github` \| `google` \| `email` \| `none` | `none` | Only for `fullstack` |

Template inference:
- `fullstack` → `nextjs-prisma-tailwind`
- `spa` → `vite-react-tailwind`
- `api` → `hono-api`

## `models`

Each model is a key (the model name) mapping to an object with `fields`.

```yaml
models:
  User:
    fields:
      id: cuid
      email: string @unique
      name: string?
      posts: Post[]
  Post:
    fields:
      id: cuid
      title: string
      content: string
      published: boolean @default(false)
      author: User @relation
      createdAt: datetime @default(now())
```

### Field type syntax

| Type | Description |
|------|-------------|
| `cuid` | CUID2 primary key |
| `string` | Required string |
| `string?` | Optional string |
| `int` | Integer |
| `boolean` | Boolean |
| `datetime` | Timestamp |
| `Model` | Relation to another model |
| `Model[]` | Has-many relation |

### Modifiers

| Modifier | Meaning |
|----------|---------|
| `@unique` | Unique constraint |
| `@default(value)` | Default value (e.g., `@default(false)`, `@default(now())`) |
| `@relation` | Marks a relation field |

## `pages`

```yaml
pages:
  - path: /dashboard
    description: Main user dashboard
    auth: true
    features:
      - list todos
      - add todo
      - delete todo
```

| Field | Description |
|-------|-------------|
| `path` | URL path (e.g., `/`, `/dashboard`, `/posts/[id]`) |
| `description` | What the page does |
| `auth` | Whether the page requires authentication (boolean) |
| `features` | Bullet list of UI features for this page |

## `features`

Features are the buildable units. The orchestrator processes them in declaration order (with parallelism if enabled). Each one ends with a git commit.

```yaml
features:
  - name: todo-crud
    description: Full CRUD for todos with optimistic updates
    skills: [api-design, database, react-component, state-management]
    depends_on: [auth]   # optional — explicit dependency
```

| Field | Description |
|-------|-------------|
| `name` | Short identifier (used in commit messages) |
| `description` | Sentence explaining what the feature does |
| `skills` | List of skill short-names that should inform the implementation |
| `depends_on` | Optional list of feature names this feature must wait for. Overrides the orchestrator's auto-inference. |

### When to use `depends_on`

The orchestrator auto-infers dependencies from feature descriptions, models, and pages. You only need `depends_on` when:
- Auto-inference misses a real dependency (e.g., features that share state but don't share files)
- You want to force a specific build order for review purposes
- You explicitly want a feature to wait until something else lands

You do NOT need `depends_on` for:
- Auth → authenticated features (auto-inferred from `auth: true` on pages)
- Features touching the same model (auto-inferred from model name overlap)
- Test features (auto-inferred to depend on prior implementation features)

### Available skill short-names

`react-component`, `react-hooks`, `state-management`, `styling`, `routing`, `api-design`, `database`, `authentication`, `docker`, `ci-cd`, `react-testing`, `e2e-testing`

See the orchestrator's skill mapping table in `agents/orchestrator.md` for paths.
