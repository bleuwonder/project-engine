# ============================================================
# Multi-target Dockerfile for project-engine monorepo
#
# Targets:
#   factory-migrate    one-shot: runs DB schema migrations
#   factory-workers    long-running: Temporal worker pool
#   factory-dashboard  long-running: Next.js read-only dashboard
#
# Build context: repo root (docker-compose sets context: ..)
# ============================================================

# ── Stage 1: install deps ────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# Copy manifests first so npm install is cached unless deps change
COPY package.json ./
COPY packages/types/package.json  packages/types/
COPY packages/db/package.json     packages/db/
COPY workers/package.json         workers/
COPY ui/plugin/package.json       ui/plugin/
COPY ui/dashboard/package.json    ui/dashboard/

RUN npm install

# ── Stage 2: build all packages ─────────────────────────────
FROM deps AS builder
COPY . .

# Build in dependency order: types → db → workers → dashboard
RUN npm run build -w @factory/types \
 && npm run build -w @factory/db \
 && npm run build -w workers \
 && npm run build -w @factory/dashboard

# ── Target: factory-migrate ──────────────────────────────────
FROM node:22-slim AS factory-migrate
WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/packages/types            ./packages/types
COPY --from=builder /app/packages/db               ./packages/db

# DATABASE_URL must be set at runtime
CMD ["node", "packages/db/dist/migrate.js"]

# ── Target: factory-workers ──────────────────────────────────
FROM node:22-slim AS factory-workers
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
# Trust any mounted workspace volume — safe.directory required when host UID != container UID
RUN git config --global --add safe.directory '*'
WORKDIR /app

COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/packages/types            ./packages/types
COPY --from=builder /app/packages/db               ./packages/db
COPY --from=builder /app/workers                   ./workers

# Required env: TEMPORAL_ADDRESS, DATABASE_URL, WORKSPACE_ROOT
CMD ["node", "workers/dist/worker.js"]

# ── Target: factory-dashboard ────────────────────────────────
FROM node:22-slim AS factory-dashboard
WORKDIR /app

# Next.js standalone output bundles everything needed to run
COPY --from=builder /app/ui/dashboard/.next/standalone    ./
COPY --from=builder /app/ui/dashboard/.next/static        ./ui/dashboard/.next/static

# Required env: DATABASE_URL, TEMPORAL_ADDRESS, NEXT_PUBLIC_BASE_URL
ENV PORT=3100
EXPOSE 3100
CMD ["node", "ui/dashboard/server.js"]
