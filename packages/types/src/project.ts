import type { WorkflowPhase } from './workflow.js'

export interface Project {
  id: string
  name: string
  phase: WorkflowPhase
  activeWorkflowId?: string
  lastRunId?: string
  createdAt: string
  updatedAt: string
}

export interface Run {
  id: string
  projectId: string
  workflowId: string
  status: 'running' | 'complete' | 'partial_failure' | 'failed'
  agentsSpawned: number
  agentsCompleted: number
  agentsFailed: number
  failedAgents: FailedAgent[]
  startedAt: string
  completedAt?: string
  costUsd?: number
}

export interface FailedAgent {
  agentId: string
  task: string
  reason: string
  retriesExhausted: boolean
}

export interface RunFile {
  runId: string
  workflowId: string
  projectId: string
  startedAt: string
  completedAt?: string
  status: Run['status']
  agentsSpawned: number
  agentsCompleted: number
  agentsFailed: number
  failedAgents: FailedAgent[]
  findings: string
  gaps: string
}
