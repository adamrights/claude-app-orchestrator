# Docker for Fullstack Apps

## When to use
When containerizing a Node.js/React application.

## Multi-Stage Dockerfile (Next.js)

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

## Docker Compose for Development

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes: ["./src:/app/src"]
    env_file: .env.local
    depends_on: [db]

  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes: [pgdata:/var/lib/postgresql/data]

volumes:
  pgdata:
```

## Guidelines
- Use multi-stage builds to keep images small.
- Pin base image versions for reproducibility.
- Add `.dockerignore` with `node_modules`, `.next`, `.git`.
- Run as non-root user in production.
