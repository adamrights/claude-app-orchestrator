---
tags: [secrets, env-vars, credentials, security, dotenv]
---

# Secrets Management

## When to use
Any application that uses API keys, database connection strings, auth secrets, tokens, or other credentials. This applies from local development through production deployment.

## Guidelines

- **Never commit secrets.** Add `.env` and `.env.local` to `.gitignore`. Maintain a `.env.example` with placeholder values so teammates know which vars are required.
- **Validate at startup.** Use a Zod-parsed env module (e.g., `src/env.ts`) that parses `process.env` on import. The app should crash immediately if a required secret is missing, not fail silently at runtime.
- **Use SCREAMING_SNAKE_CASE.** Prefix by service: `STRIPE_SECRET_KEY`, `DATABASE_URL`, `GITHUB_CLIENT_ID`. This makes it clear where each secret is used.
- **Separate defaults from overrides.** `.env` holds non-sensitive defaults (ports, feature flags). `.env.local` holds actual secrets and overrides. Only `.env` is committed.
- **Never embed secrets in Docker images.** Do not use `ENV SECRET=...` in Dockerfiles. Pass secrets via environment variables at runtime or use Docker secrets in Compose.
- **Design for rotation.** Use short-lived tokens where possible. Separate read and write credentials so rotating one does not affect the other. Your app should not require a redeploy to pick up a rotated secret.
- **Audit regularly.** Rotate credentials on a schedule. Revoke unused keys. Scan for leaked secrets with `git log --all --full-history -S "sk_live"` or tools like `gitleaks`.

### Platform Patterns

- **Vercel:** Add secrets via dashboard or `vercel env add`. Use separate values for Preview, Development, and Production environments.
- **Railway:** Set secrets in the service's Variables tab. They are injected at build and runtime.
- **AWS:** Use AWS Secrets Manager or SSM Parameter Store for production secrets. Fetch at startup, not baked into config.
- **1Password CLI:** Use `op run` to inject secrets from a 1Password vault into local dev commands without writing them to disk.
- **GitHub Actions:** Use repository or environment secrets (`${{ secrets.MY_SECRET }}`). Never echo secrets in logs. Mask with `::add-mask::`.

### CI/CD

- **Use GitHub Actions secrets**, not plain environment variables in workflow YAML. Secrets are masked in logs automatically.
- **Scope secrets narrowly.** Use environment-level secrets (e.g., `production` environment) over repository-level where possible.
- **Never log secrets.** If debugging requires seeing a secret's value, something is architecturally wrong.

## Environment Module Pattern

```tsx
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
});

export const env = EnvSchema.parse(process.env);
```

## `.env.example`

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/myapp"

# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Checklist
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] `.env.example` exists with placeholder values for all required vars
- [ ] Environment variables are validated at startup with Zod
- [ ] No secrets are embedded in Docker images
- [ ] CI/CD uses platform secret management, not plain env vars
- [ ] Secret names use SCREAMING_SNAKE_CASE with service prefixes
- [ ] Credentials are rotated on a regular schedule
- [ ] Repository has been scanned for accidentally committed secrets
