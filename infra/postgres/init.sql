-- postgres/init.sql
-- Runs once on first container start (docker-entrypoint-initdb.d).
-- Creates application databases. DO NOT create temporal or temporal_visibility here —
-- temporalio/auto-setup creates and owns those on its first run.

CREATE DATABASE factory;
CREATE DATABASE langfuse;
CREATE DATABASE litellm;

-- Enable pgvector on the factory database.
-- Required for project-scoped RAG (embeddings table in packages/db/schema.ts).
\c factory
CREATE EXTENSION IF NOT EXISTS vector;
