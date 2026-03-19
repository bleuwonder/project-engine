export type WorkflowPhase =
  | 'discovery'
  | 'planning'
  | 'building'
  | 'review'
  | 'merge'
  | 'complete'
  | 'failed'

export type CostSignal = 'low' | 'medium' | 'high'
export type Complexity = 'simple' | 'medium' | 'complex'
export type TaskType =
  | 'discovery'
  | 'planning'
  | 'code'
  | 'review'
  | 'security'
  | 'deploy'

export interface Message {
  role: 'human' | 'agent'
  content: string
  timestamp: string
}

export interface DiscoveryState {
  projectId: string
  conversation: Message[]
  approved: boolean
  hasMetrics: boolean
  currentPhase: WorkflowPhase
}
