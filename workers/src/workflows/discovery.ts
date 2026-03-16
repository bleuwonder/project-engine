import * as workflow from '@temporalio/workflow'
import type { DiscoveryState, Message } from '@factory/types'
import type { prepareAgentContext, buildSystemPrompt } from '../activities/context.js'
import type { routeToModel } from '../activities/llm.js'
import type { getCostSignal } from '../activities/cost-oracle.js'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'

// Activity proxies — deterministic wrappers, all I/O goes through activities
const { prepareAgentContext: getContext, buildSystemPrompt: buildPrompt } =
  workflow.proxyActivities<{
    prepareAgentContext: typeof prepareAgentContext
    buildSystemPrompt: typeof buildSystemPrompt
  }>({ startToCloseTimeout: '30s' })

const { routeToModel: llm, getCostSignal: costSignal } =
  workflow.proxyActivities<{
    routeToModel: typeof routeToModel
    getCostSignal: typeof getCostSignal
  }>({ startToCloseTimeout: '5m' })

const { checkMetricsGate: metricsGate } =
  workflow.proxyActivities<{ checkMetricsGate: typeof checkMetricsGate }>({
    startToCloseTimeout: '10s',
    retry: { maximumAttempts: 1 },
  })

const { writeRunFile: writeRun } =
  workflow.proxyActivities<{ writeRunFile: typeof writeRunFile }>({
    startToCloseTimeout: '30s',
  })

const { upsertProject: dbUpsertProject, insertRun: dbInsertRun } =
  workflow.proxyActivities<{
    upsertProject: typeof upsertProject
    insertRun: typeof insertRun
  }>({ startToCloseTimeout: '15s' })

// Signals
export const userMessageSignal = workflow.defineSignal<[string]>('userMessage')
export const approvePlanSignal = workflow.defineSignal<[]>('approvePlan')

// Queries
export const currentStateQuery = workflow.defineQuery<DiscoveryState>('currentState')

export async function DiscoveryWorkflow(projectId: string): Promise<void> {
  const startedAt = new Date().toISOString()
  const workflowId = workflow.workflowInfo().workflowId

  const state: DiscoveryState = {
    projectId,
    conversation: [],
    approved: false,
    hasMetrics: false,
    currentPhase: 'discovery',
  }

  workflow.setHandler(currentStateQuery, () => state)

  workflow.setHandler(userMessageSignal, async (message: string) => {
    state.conversation.push({ role: 'human', content: message, timestamp: new Date().toISOString() })

    const [ctx, cost] = await Promise.all([getContext(projectId), costSignal()])
    const systemPrompt = buildPrompt(ctx)

    const conversationText = state.conversation
      .map(m => `${m.role === 'human' ? 'Human' : 'Agent'}: ${m.content}`)
      .join('\n')

    const reply = await llm(conversationText, 'discovery', 'medium', cost, systemPrompt)
    state.conversation.push({ role: 'agent', content: reply, timestamp: new Date().toISOString() })

    // Check if GOALS.md now has a measurable metric (non-blocking — just update state)
    try {
      await metricsGate(projectId)
      state.hasMetrics = true
    } catch {
      state.hasMetrics = false
    }
  })

  workflow.setHandler(approvePlanSignal, () => {
    state.approved = true
  })

  await dbUpsertProject(projectId, projectId, 'discovery', workflowId)

  // Wait for human approval (up to 7 days)
  await workflow.condition(() => state.approved, '7 days')

  // Final metrics gate — blocks completion if no measurable metric
  await metricsGate(projectId)

  state.currentPhase = 'complete'
  await dbUpsertProject(projectId, projectId, 'complete')

  const runId = `${projectId}-discovery-${Date.now()}`
  const runFile = {
    runId,
    workflowId,
    projectId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: 'complete' as const,
    agentsSpawned: 0,
    agentsCompleted: 0,
    agentsFailed: 0,
    failedAgents: [],
    findings: state.conversation
      .filter(m => m.role === 'agent')
      .map(m => m.content)
      .join('\n\n'),
    gaps: '',
  }

  await Promise.all([writeRun(projectId, runFile), dbInsertRun(runFile)])
}
