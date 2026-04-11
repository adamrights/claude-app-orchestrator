# CI/CD

## When to use
When setting up continuous integration and deployment pipelines.

## GitHub Actions — Node.js/Next.js

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

## Guidelines
- Run lint, typecheck, and tests on every PR.
- Cache dependencies to speed up builds.
- Use preview deployments (Vercel, Netlify) for PR review.
- Keep CI under 5 minutes — parallelize jobs when possible.
- Pin action versions to specific commits or major versions.
