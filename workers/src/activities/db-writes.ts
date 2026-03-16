import { sql } from '@factory/db'
import type { RunFile, WorkflowPhase } from '@factory/types'

export async function upsertProject(
  id: string,
  name: string,
  phase: WorkflowPhase,
  activeWorkflowId?: string,
): Promise<void> {
  await sql`
    INSERT INTO projects (id, name, phase, active_workflow_id, updated_at)
    VALUES (${id}, ${name}, ${phase}, ${activeWorkflowId ?? null}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      phase = EXCLUDED.phase,
      active_workflow_id = EXCLUDED.active_workflow_id,
      updated_at = NOW()
  `
}

export async function insertRun(run: RunFile): Promise<void> {
  await sql`
    INSERT INTO runs (id, project_id, workflow_id, status, agents_spawned, agents_completed, agents_failed, started_at, completed_at)
    VALUES (
      ${run.runId}, ${run.projectId}, ${run.workflowId}, ${run.status},
      ${run.agentsSpawned}, ${run.agentsCompleted}, ${run.agentsFailed},
      ${run.startedAt}, ${run.completedAt ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      agents_completed = EXCLUDED.agents_completed,
      agents_failed = EXCLUDED.agents_failed,
      completed_at = EXCLUDED.completed_at
  `
}
