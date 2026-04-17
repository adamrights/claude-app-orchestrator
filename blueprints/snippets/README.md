# Blueprint Snippets

Paste-ready YAML fragments for common SaaS capabilities. Each snippet is a
documented set of additions you merge into the right sections of your
blueprint — not a standalone blueprint.

## Available snippets

| Snippet | What it adds | Depends on |
|---------|--------------|------------|
| [auth-github](auth-github.yaml) | GitHub OAuth via NextAuth | (none — start here) |
| [multi-tenant](multi-tenant.yaml) | Organization + Membership models, tenant-scoped queries | auth-* |
| [billing-stripe](billing-stripe.yaml) | Stripe Checkout + subscriptions + webhooks | auth-*, multi-tenant (recommended) |
| [file-uploads-s3](file-uploads-s3.yaml) | S3/R2/MinIO presigned uploads | auth-* |
| [email-transactional](email-transactional.yaml) | Resend/Postmark integration + react-email templates | (none) |
| [observability-sentry](observability-sentry.yaml) | Sentry + structured logging | (none) |

## How to compose

1. Start from a blueprint base — copy `blueprints/examples/saas-platform.yaml` or write a small one with `name`, `description`, `stack`, and a couple of features.
2. Open a snippet. Each section is marked with `# === MERGE INTO: <section>: ===`.
3. Paste each section into the matching part of your blueprint. If the destination section doesn't exist yet, create it.
4. Resolve any `# TODO:` markers in the snippet (typically project-specific names or env values).
5. Run `node scripts/validate-blueprint.mjs your-blueprint.yaml` to verify the merged result.

## Authoring new snippets

Each snippet should be self-contained, named after the capability (kebab-case),
and include `# === MERGE INTO: ===` headers, env-var declarations, and a
"skills referenced" footer. Keep snippets focused on ONE capability — composing
several is the user's job, not the snippet's.
