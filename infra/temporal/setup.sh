#!/bin/sh
# temporal/setup.sh
# Runs inside temporalio/admin-tools:1.30.1 to bootstrap Temporal's PostgreSQL schema.
# Called by the temporal-setup service on every `docker compose up` (idempotent).
#
# Databases are pre-created by postgres/init.sql (docker-entrypoint-initdb.d).
# This script only applies schema migrations — no database creation needed.
#
# Environment variables (passed from docker-compose temporal-setup service):
#   POSTGRES_SEEDS  – postgres hostname
#   DB_PORT         – postgres port (default 5432)
#   POSTGRES_USER   – postgres user
#   POSTGRES_PWD    – postgres password
#
# Plugin note: temporal-sql-tool uses "postgres12"; server config.yaml uses "postgresql12".
# These are different registries — both are correct for their respective contexts.

set -e

DB_PORT="${DB_PORT:-5432}"

echo "[temporal-setup] Setting up temporal schema..."
temporal-sql-tool \
  --plugin postgres12 \
  --endpoint "${POSTGRES_SEEDS}" \
  --port "${DB_PORT}" \
  --user "${POSTGRES_USER}" \
  --password "${POSTGRES_PWD}" \
  --db temporal \
  setup-schema -v 0.0

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
  setup-schema -v 0.0

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
