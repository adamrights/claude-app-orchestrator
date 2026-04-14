# Blueprint Schema

A blueprint is a YAML file with the following top-level fields.

## Versioning

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | no | Schema version. `2` enables v2 sections below. Missing or `1` = v1 (legacy). |

The orchestrator treats a missing `version` field as v1 and applies a shim: all v2-only sections (`integrations`, `jobs`, `webhooks`, `tenancy`, `rbac`, `flags`, `shared`, `config`) are silently ignored. Existing v1 blueprints work unchanged.

## Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | no | Schema version (`1` or `2`) |
| `name` | string | yes | Project name (used for package.json, directory, CLAUDE.md) |
| `description` | string | yes | One-line summary |
| `stack` | object | no | Drives template inference |
| `template` | string | no | Explicit template name (overrides `stack`-based inference) |
| `execution` | string | no | `auto` (default), `parallel`, or `sequential` — controls parallel execution |
| `models` | object | no | Database models, keyed by model name |
| `pages` | array | no | UI routes (ignored for `type: api`) |
| `features` | array | yes | Buildable units, processed in declaration order (with parallelism if enabled) |
| `integrations` | array | no | External service dependencies (v2) |
| `jobs` | array | no | Background tasks — cron or queue-driven (v2) |
| `webhooks` | array | no | Inbound webhook endpoints (v2) |
| `tenancy` | object | no | Multi-tenancy model (v2) |
| `rbac` | object | no | Role-based access control (v2) |
| `flags` | object | no | Feature flags (v2) |
| `shared` | array | no | Cross-feature primitives built before any feature (v2) |
| `config` | object | no | Per-environment settings (v2) |

---

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

### Per-field validation (v2)

Fields can include a `validation:` property with a Zod expression. These get injected into the contract's request schemas and into API validation middleware.

```yaml
models:
  User:
    fields:
      id: cuid
      email: string @unique
        validation: z.string().email()
      name: string
        validation: z.string().min(1).max(100)
      age: int?
        validation: z.number().int().min(0).max(150).optional()
```

The orchestrator passes validation expressions to the Contract Designer, which embeds them in Zod schemas. The API Endpoint Builder uses them for request validation middleware.

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
| `extends` | Optional name of another feature whose skills and depends_on are inherited (v2) |

### Feature inheritance with `extends` (v2)

A feature can extend another to inherit its skills and dependencies.

```yaml
features:
  - name: base-crud
    description: Generic CRUD pattern
    skills: [api-design, database]
  - name: todo-crud
    extends: base-crud
    description: Todo-specific CRUD with completion toggle
    skills: [react-component]
```

When a feature `extends` another, the orchestrator merges the parent's `skills` and `depends_on` into the child. The child's own `skills` and `depends_on` are added on top (not replaced). The parent feature is still built independently.

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

**Frontend:** `react-component`, `react-hooks`, `state-management`, `styling`, `routing`, `error-handling`, `forms`, `accessibility`, `optimistic-updates`, `data-fetching`, `data-tables`, `pagination`, `performance`

**Backend:** `api-design`, `database`, `authentication`, `trpc`, `graphql`, `validation`, `migrations`, `rate-limiting`, `search`, `caching`

**DevOps:** `docker`, `ci-cd`, `secrets`

**Testing:** `react-testing`, `e2e-testing`

See the orchestrator's skill mapping table in `agents/orchestrator.md` for paths.

---

## V2 Sections

The following sections are only processed when `version: 2` is set. If the blueprint has no `version` field or `version: 1`, the orchestrator ignores them.

---

### `integrations`

External service dependencies. Each entry names a service and its required env vars.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service` | string | yes | Service identifier (e.g., `stripe`, `resend`, `s3`) |
| `purpose` | string | yes | What the integration is used for |
| `env_vars` | array | yes | Environment variable names required |
| `sdk` | string | yes | npm package to install |

```yaml
integrations:
  - service: stripe
    purpose: payment processing
    env_vars: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]
    sdk: stripe
  - service: resend
    purpose: transactional email
    env_vars: [RESEND_API_KEY]
    sdk: resend
  - service: s3
    purpose: file uploads
    env_vars: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET]
    sdk: "@aws-sdk/client-s3"
```

The orchestrator adds these env vars to `.env.example`, installs the SDKs in `package.json`, and invokes the Integration Specialist to create a typed client wrapper per integration.

---

### `jobs`

Background tasks, either cron-scheduled or queue-driven.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Job identifier |
| `trigger` | string | yes | `cron` or `queue` |
| `schedule` | string | cron only | Cron expression (e.g., `"0 9 * * 1"`) |
| `queue` | string | queue only | Queue name to consume from |
| `description` | string | yes | What the job does |
| `skills` | array | no | Skills that inform the implementation |

```yaml
jobs:
  - name: send-weekly-digest
    trigger: cron
    schedule: "0 9 * * 1"
    description: Email each user a summary of their week's activity
    skills: [api-design]
  - name: process-upload
    trigger: queue
    queue: uploads
    description: Resize uploaded images and generate thumbnails
    skills: [api-design]
```

The orchestrator routes each job to the Background Jobs Specialist, which creates the handler and registers the trigger.

---

### `webhooks`

Inbound webhook endpoints from third parties.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | yes | Service sending the webhook (e.g., `stripe`, `github`) |
| `event` | string | yes | Event type to handle |
| `path` | string | yes | API route path for the webhook endpoint |
| `description` | string | yes | What happens when the webhook fires |
| `skills` | array | no | Skills that inform the implementation |

```yaml
webhooks:
  - source: stripe
    event: checkout.session.completed
    path: /api/webhooks/stripe
    description: Fulfill order after successful payment
    skills: [api-design, database]
  - source: github
    event: push
    path: /api/webhooks/github
    description: Trigger deployment pipeline on push
    skills: [api-design]
```

Each webhook becomes a route handler with signature verification. The orchestrator treats each webhook as a mini-feature during the post-feature phase.

---

### `tenancy`

Multi-tenancy model.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | yes | Tenant entity name (e.g., `organization`, `workspace`, `team`) |
| `isolation` | string | yes | `row-level` or `schema-level` |
| `fields` | object | yes | Fields on the tenant model (same syntax as model fields) |
| `user_relation` | string | yes | `one-to-many` or `many-to-many` |

```yaml
tenancy:
  model: organization
  isolation: row-level
  fields:
    name: string
    slug: string @unique
    plan: string @default(free)
  user_relation: many-to-many
```

The orchestrator generates the tenant model, adds `orgId` foreign keys to tenant-scoped models, and passes the tenancy config to the RBAC Specialist for tenant-scoped permission checks.

---

### `rbac`

Role-based access control.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | array | yes | List of role definitions (each with `name` and `permissions`) |
| `default_role` | string | yes | Role assigned to new users |

```yaml
rbac:
  roles:
    - name: owner
      permissions: [manage_org, manage_members, manage_billing, read, write, delete]
    - name: admin
      permissions: [manage_members, read, write, delete]
    - name: member
      permissions: [read, write]
    - name: viewer
      permissions: [read]
  default_role: member
```

The orchestrator invokes the RBAC Specialist to generate a permissions module and authorization middleware. Routes are protected based on the required permissions.

---

### `flags`

Feature flags.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | yes | `env`, `statsig`, `launchdarkly`, or `unleash` |
| `flags` | array | yes | List of flag definitions (each with `name`, `description`, `default`) |

```yaml
flags:
  provider: env
  flags:
    - name: new_dashboard
      description: Show redesigned dashboard
      default: false
    - name: ai_suggestions
      description: Enable AI-powered suggestions
      default: false
```

For `provider: env`, flags are simple env vars (`FLAG_NEW_DASHBOARD=true`). For external providers, the orchestrator generates a typed flags module wrapping the provider's SDK.

---

### `shared`

Cross-feature primitives built before any feature.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Primitive identifier |
| `description` | string | yes | What the primitive provides |
| `skills` | array | yes | Skills that inform the implementation |

```yaml
shared:
  - name: design-system
    description: Button, Input, Card, Modal base components with Tailwind variants
    skills: [react-component, styling, accessibility]
  - name: api-client
    description: Typed fetch wrapper with auth header injection and error handling
    skills: [react-hooks]
```

The orchestrator builds shared primitives in a pre-wave (Wave -1) before any feature wave, so all features can import them. Each shared entry is built like a feature — load skills, build, test, commit — but runs before the dependency graph kicks in.

---

### `config`

Per-environment settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `environments` | array | yes | List of environment names |
| `vars` | object | yes | Keys are variable names; values are objects mapping environment → value |

```yaml
config:
  environments: [development, staging, production]
  vars:
    API_RATE_LIMIT:
      development: 1000
      staging: 100
      production: 50
    ENABLE_DEBUG_LOGGING:
      development: true
      staging: true
      production: false
```

The orchestrator generates a typed config module at `src/lib/config.ts` that reads from env vars with per-environment defaults. This module is created during scaffolding (Phase 1).
