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

// ── Primary: ProjectWorkflow orchestrator ──────────────────────

export async function startProject(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('ProjectWorkflow', {
    taskQueue: 'factory',
    workflowId: projectId,
    args: [projectId],
  })
  return handle.workflowId
}

export interface ProjectState {
  projectId: string
  phase: 'discovery' | 'planning' | 'coding' | 'review' | 'merge' | 'complete'
  childIds: {
    discovery: string
    planning: string
    coding: string
    review: string
    merge: string
  }
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  const client = await getClient()
  return client.workflow.getHandle(projectId).query<ProjectState>('projectState')
}

// ── Signals (sent to child workflows by deterministic ID) ──────

export async function sendMessage(projectId: string, message: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(`${projectId}-discovery`).signal('userMessage', message)
}

export async function approvePlan(projectId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(`${projectId}-discovery`).signal('approvePlan')
}

export async function approvePR(projectId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(`${projectId}-review`).signal('approvePR')
}

// ── Child workflow state queries ───────────────────────────────

export async function getDiscoveryState(projectId: string): Promise<DiscoveryState> {
  const client = await getClient()
  return client.workflow.getHandle(`${projectId}-discovery`).query<DiscoveryState>('currentState')
}

export async function getPlanningState(projectId: string): Promise<PlanningState> {
  const client = await getClient()
  return client.workflow.getHandle(`${projectId}-planning`).query<PlanningState>('currentState')
}

export async function getCodingState(projectId: string): Promise<CodingState> {
  const client = await getClient()
  return client.workflow.getHandle(`${projectId}-coding`).query<CodingState>('currentState')
}

export async function getReviewState(projectId: string): Promise<ReviewState> {
  const client = await getClient()
  return client.workflow.getHandle(`${projectId}-review`).query<ReviewState>('currentState')
}

// ── Standalone phase starts (debugging / manual re-runs) ───────

export async function startDiscovery(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('DiscoveryWorkflow', {
    taskQueue: 'factory',
    workflowId: `${projectId}-discovery-${Date.now()}`,
    args: [projectId],
  })
  return handle.workflowId
}

export async function startPlanning(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('planningWorkflow', {
    taskQueue: 'factory',
    workflowId: `${projectId}-planning-${Date.now()}`,
    args: [projectId],
  })
  return handle.workflowId
}

export async function startCoding(projectId: string, tasks: TaskItem[]): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('codingWorkflow', {
    taskQueue: 'factory',
    workflowId: `${projectId}-coding-${Date.now()}`,
    args: [projectId, tasks],
  })
  return handle.workflowId
}

export async function startReview(projectId: string, branchName: string, codingRunId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('reviewWorkflow', {
    taskQueue: 'factory',
    workflowId: `${projectId}-review-${Date.now()}`,
    args: [projectId, branchName, codingRunId],
  })
  return handle.workflowId
}

export async function startMerge(projectId: string, branchName: string, prNumber: number): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start('mergeWorkflow', {
    taskQueue: 'factory',
    workflowId: `${projectId}-merge-${Date.now()}`,
    args: [projectId, branchName, prNumber],
  })
  return handle.workflowId
}
