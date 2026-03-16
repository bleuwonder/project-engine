import { Client, Connection } from '@temporalio/client'
import type { DiscoveryState, PlanningState, CodingState, ReviewState, TaskItem } from '@factory/types'

let _client: Client | null = null

async function getClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    })
    _client = new Client({ connection })
  }
  return _client
}

export async function startProject(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('DiscoveryWorkflow', {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-discovery`,
    args: [projectId],
  })
  return handle.workflowId
}

export async function sendMessage(workflowId: string, message: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal('userMessage', message)
}

export async function approvePlan(workflowId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal('approvePlan')
}

export async function getState(workflowId: string): Promise<DiscoveryState> {
  const client = await getClient()
  return client.workflow.getHandle(workflowId).query<DiscoveryState>('currentState')
}

// ── Phase 1: Planning ────────────────────────────────────────

export async function startPlanning(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('planningWorkflow', {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-planning-${Date.now()}`,
    args: [projectId],
  })
  return handle.workflowId
}

export async function approvePlanningPlan(workflowId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal('approvePlan')
}

export async function getPlanningState(workflowId: string): Promise<PlanningState> {
  const client = await getClient()
  return client.workflow.getHandle(workflowId).query<PlanningState>('currentState')
}

// ── Phase 1: Coding ──────────────────────────────────────────

export async function startCoding(projectId: string, tasks: TaskItem[]): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('codingWorkflow', {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-coding-${Date.now()}`,
    args: [projectId, tasks],
  })
  return handle.workflowId
}

export async function getCodingState(workflowId: string): Promise<CodingState> {
  const client = await getClient()
  return client.workflow.getHandle(workflowId).query<CodingState>('currentState')
}

// ── Phase 1: Review ──────────────────────────────────────────

export async function startReview(
  projectId: string,
  branchName: string,
  codingRunId: string,
): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('reviewWorkflow', {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-review-${Date.now()}`,
    args: [projectId, branchName, codingRunId],
  })
  return handle.workflowId
}

export async function approvePR(workflowId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal('approvePR')
}

export async function getReviewState(workflowId: string): Promise<ReviewState> {
  const client = await getClient()
  return client.workflow.getHandle(workflowId).query<ReviewState>('currentState')
}

// ── Phase 1: Merge ───────────────────────────────────────────

export async function startMerge(
  projectId: string,
  branchName: string,
  prNumber: number,
): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('mergeWorkflow', {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-merge-${Date.now()}`,
    args: [projectId, branchName, prNumber],
  })
  return handle.workflowId
}
