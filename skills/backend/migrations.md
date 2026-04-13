---
tags: [migrations, prisma-migrate, drizzle-kit, schema-change, database]
---

# Migrations

## When to use
Any time the database schema changes — adding tables, columns, indexes, constraints, or modifying existing structures — in development or production. Migrations are the only safe way to evolve a database schema.

## Guidelines

### General Principles
- **Every schema change must be a migration.** Never modify the database manually in production.
- **Migrations are immutable once deployed.** If a migration has been applied in production or shared environments, create a new migration to fix issues — never edit the applied one.
- **Name migrations descriptively:** lowercase, underscore-separated. `add_user_email_index`, `create_posts_table`, `drop_legacy_status_column`.
- **Review destructive migrations manually.** `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE` require explicit review. Always back up before applying in production.
- **Keep schema migrations and data migrations separate.** Schema changes go in migration files. Data backfills run as standalone scripts after the schema migration succeeds.
- **Seeds must be idempotent.** Running `seed` twice should not create duplicate data. Use upserts or check-before-insert patterns.

### Prisma Workflow
- **Development:** `npx prisma migrate dev --name add_user_email` generates a migration from schema diff and applies it.
- **Production:** `npx prisma migrate deploy` applies pending migrations without generating new ones. Run in CI or deployment pipeline.
- **Never use `prisma db push` in production.** It modifies the database without creating a migration file, making changes untrackable.
- **Reset in dev only:** `npx prisma migrate reset` drops the database, re-applies all migrations, and runs seeds. Never in production.
- **Down migrations:** Prisma does not support down migrations natively. Write a compensating "up" migration (e.g., re-add the dropped column).

### Drizzle Workflow
- **Generate:** `npx drizzle-kit generate` creates migration SQL files from schema changes.
- **Development:** `npx drizzle-kit push` applies schema directly for fast iteration (equivalent to Prisma's `db push`).
- **Production:** `npx drizzle-kit migrate` applies migration files in order.
- **Drizzle can generate reversal migrations** — use this for rollback planning, but always test reversals before relying on them.

### Zero-Downtime Patterns
When renaming or removing columns in a live application, use multi-step migrations:

1. **Add the new column** (nullable or with a default).
2. **Deploy code** that writes to both old and new columns.
3. **Backfill** the new column from the old column's data.
4. **Deploy code** that reads from the new column only.
5. **Drop the old column** in a final migration.

This prevents downtime because the application can serve requests during every step.

### CI Integration
- **Run migrations in CI before tests.** Apply all migrations to a test database, then run the test suite.
- **Fail the build if the schema is out of sync.** For Prisma: `npx prisma migrate diff --exit-code`. For Drizzle: `npx drizzle-kit check`.
- **Include migration files in code review.** Treat them as carefully as application code.

## Example: Prisma Migration Flow

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate and apply migration
npx prisma migrate dev --name add_posts_published_at

# 3. Check generated SQL in prisma/migrations/
# 4. Commit the migration file alongside the schema change
```

## Example: Drizzle Migration Flow

```bash
# 1. Edit your drizzle schema file (e.g., src/db/schema.ts)
# 2. Generate migration
npx drizzle-kit generate

# 3. Review generated SQL in drizzle/ directory
# 4. Apply in dev
npx drizzle-kit push

# 5. Apply in production
npx drizzle-kit migrate
```

## Checklist
- [ ] Every schema change has a corresponding migration file
- [ ] Destructive changes are reviewed and backed up before applying
- [ ] Migration names are descriptive and follow naming convention
- [ ] `prisma db push` is not used in production
- [ ] Data migrations are separate scripts, not in migration files
- [ ] Seeds are idempotent
- [ ] CI runs migrations before tests and checks for schema drift
- [ ] Zero-downtime pattern used for column renames/removals in production
