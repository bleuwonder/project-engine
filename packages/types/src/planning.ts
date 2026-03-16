export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed'

export interface TaskItem {
  id: string
  description: string
  outputFiles: string[]
  requirements: string
  status: TaskStatus
  agentOutput?: string
}

export interface PlanningState {
  projectId: string
  architecture: string
  tasks: TaskItem[]
  approved: boolean
  currentPhase: 'planning'
}

export interface CodingState {
  projectId: string
  branchName: string
  tasks: TaskItem[]
  currentTaskIndex: number
  testsPassed: boolean
  testOutput: string
  currentPhase: 'building'
}

export interface ReviewState {
  projectId: string
  branchName: string
  prUrl: string
  prNumber: number
  findings: string
  approved: boolean
  currentPhase: 'review'
}

export interface MergeState {
  projectId: string
  branchName: string
  merged: boolean
  currentPhase: 'complete'
}
