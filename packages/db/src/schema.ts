import { sql } from './client.js'

export async function migrate(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      phase               TEXT NOT NULL DEFAULT 'discovery',
      active_workflow_id  TEXT,
      last_run_id         TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id                  TEXT PRIMARY KEY,
      project_id          TEXT REFERENCES projects(id),
      workflow_id         TEXT NOT NULL,
      status              TEXT NOT NULL,
      agents_spawned      INT DEFAULT 0,
      agents_completed    INT DEFAULT 0,
      agents_failed       INT DEFAULT 0,
      started_at          TIMESTAMPTZ,
      completed_at        TIMESTAMPTZ,
      cost_usd            NUMERIC(10,6)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS agent_results (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      run_id      TEXT REFERENCES runs(id),
      agent_id    TEXT NOT NULL,
      task        TEXT NOT NULL,
      status      TEXT NOT NULL,
      result      TEXT,
      error       TEXT,
      model_used  TEXT,
      tokens_used INT,
      cost_usd    NUMERIC(10,6),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS embeddings (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      project_id  TEXT REFERENCES projects(id),
      source_file TEXT,
      content     TEXT,
      embedding   vector(1536),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS embeddings_ivfflat
    ON embeddings USING ivfflat (embedding vector_cosine_ops)
  `

  console.log('Migration complete')
}
