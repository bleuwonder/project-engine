-- postgres/init.sql
-- Runs once on first container start (docker-entrypoint-initdb.d).
-- Creates all application databases upfront so downstream containers never race
-- against missing databases.

-- Temporal workflow persistence (schema applied by temporal-setup init container)
CREATE DATABASE temporal;
CREATE DATABASE temporal_visibility;

-- Project-engine application data (pgvector for embeddings)
CREATE DATABASE factory;

-- Langfuse observability (transactional data: users, projects, API keys)
CREATE DATABASE langfuse;

-- LiteLLM usage logs and config
CREATE DATABASE litellm;

-- Enable pgvector on the factory database.
-- Required for project-scoped RAG (embeddings table in packages/db/schema.ts).
\c factory
CREATE EXTENSION IF NOT EXISTS vector;
