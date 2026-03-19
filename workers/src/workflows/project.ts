import * as workflow from '@temporalio/workflow'
import { DiscoveryWorkflow } from './discovery.js'
import { planningWorkflow } from './planning.js'
import { codingWorkflow } from './coding.js'
import { reviewWorkflow } from './review.js'
import { mergeWorkflow } from './merge.js'

export type ProjectPhase = 'discovery' | 'planning' | 'coding' | 'review' | 'merge' | 'complete'

export interface ProjectState {
  projectId: string
  phase: ProjectPhase
  // child workflow IDs — send signals directly to these
  childIds: {
    discovery: string
    planning: string
    coding: string
    review: string
    merge: string
  }
}

export const projectStateQuery = workflow.defineQuery<ProjectState>('projectState')

export async function ProjectWorkflow(projectId: string): Promise<void> {
  const childIds = {
    discovery: `${projectId}-discovery`,
    planning:  `${projectId}-planning`,
    coding:    `${projectId}-coding`,
    review:    `${projectId}-review`,
    merge:     `${projectId}-merge`,
  }

  const state: ProjectState = { projectId, phase: 'discovery', childIds }
  workflow.setHandler(projectStateQuery, () => state)

  // Phase 1: Discovery — interactive conversation until human approves
  // Signals: userMessage → childIds.discovery, approvePlan → childIds.discovery
  await workflow.executeChild(DiscoveryWorkflow, {
    workflowId: childIds.discovery,
    taskQueue: 'factory',
    args: [projectId],
  })

  // Phase 2: Planning — LLM generates architecture + tasks, human approves
  // Signals: approvePlan → childIds.planning
  state.phase = 'planning'
  const { tasks } = await workflow.executeChild(planningWorkflow, {
    workflowId: childIds.planning,
    taskQueue: 'factory',
    args: [projectId],
  })

  // Phase 3: Coding — autonomous, no signals needed
  state.phase = 'coding'
  const { branchName, runId } = await workflow.executeChild(codingWorkflow, {
    workflowId: childIds.coding,
    taskQueue: 'factory',
    args: [projectId, tasks],
  })

  // Phase 4: Review — LLM review + PR opened, human approves PR
  // Signals: approvePR → childIds.review
  state.phase = 'review'
  const { prNumber } = await workflow.executeChild(reviewWorkflow, {
    workflowId: childIds.review,
    taskQueue: 'factory',
    args: [projectId, branchName, runId],
  })

  // Phase 5: Merge — autonomous, no signals needed
  state.phase = 'merge'
  await workflow.executeChild(mergeWorkflow, {
    workflowId: childIds.merge,
    taskQueue: 'factory',
    args: [projectId, branchName, prNumber],
  })

  state.phase = 'complete'
}
