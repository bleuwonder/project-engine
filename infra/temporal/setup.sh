#!/bin/sh
# temporal/setup.sh
# Runs inside temporalio/admin-tools:1.30.1 to bootstrap Temporal's PostgreSQL schema.
# Called by the temporal-setup service on every `docker compose up` (idempotent).
#
# What it does:
#   1. Creates the temporal and temporal_visibility databases (skips if existing)
#   2. Initialises schema at version 0.0 (no-op if schema_version table exists)
#   3. Applies all pending versioned migrations
#
# Environment variables (passed from docker-compose temporal-setup service):
#   POSTGRES_SEEDS  – postgres hostname
#   DB_PORT         – postgres port (default 5432)
#   POSTGRES_USER   – postgres user
#   POSTGRES_PWD    – postgres password

set -e

DB_PORT="${DB_PORT:-5432}"

# postgres is guaranteed ready by depends_on: postgres: condition: service_healthy
echo "[temporal-setup] Creating databases..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  create-database temporal || echo "[temporal-setup] temporal db already exists, skipping."

temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  create-database temporal_visibility || echo "[temporal-setup] temporal_visibility db already exists, skipping."

echo "[temporal-setup] Setting up temporal schema..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  --db temporal \
  setup-schema -v 0.0 || echo "[temporal-setup] temporal schema already initialised, skipping."

echo "[temporal-setup] Applying temporal versioned migrations..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  --db temporal \
  update-schema -d /etc/temporal/schema/postgresql/v12/temporal/versioned

echo "[temporal-setup] Setting up temporal_visibility schema..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  --db temporal_visibility \
  setup-schema -v 0.0 || echo "[temporal-setup] temporal_visibility schema already initialised, skipping."

echo "[temporal-setup] Applying temporal_visibility versioned migrations..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  --db temporal_visibility \
  update-schema -d /etc/temporal/schema/postgresql/v12/visibility/versioned

echo "[temporal-setup] Schema setup complete."
