# syntax=docker/dockerfile:1.7
# Multi-stage build: compile TS in `builder`, run `dist/` in slim `runner`.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 hono

COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder --chown=hono:nodejs /app/dist ./dist

USER hono
EXPOSE 8787
ENV PORT=8787

CMD ["node", "dist/index.js"]
