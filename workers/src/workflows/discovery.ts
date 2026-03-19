import * as workflow from '@temporalio/workflow'
import type { DiscoveryState, Message } from '@factory/types'
import type { prepareAgentContext, buildSystemPrompt } from '../activities/context.js'
import type { routeToModel } from '../activities/llm.js'
import type { getCostSignal } from '../activities/cost-oracle.js'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'

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

export const userMessageSignal = workflow.defineSignal<[string]>('userMessage')
export const approvePlanSignal = workflow.defineSignal<[]>('approvePlan')
export const currentStateQuery = workflow.defineQuery<DiscoveryState>('currentState')


export async function DiscoveryWorkflow(projectId: string): Promise<void> {
  const startedAt = new Date().toISOString()
  const workflowId = workflow.workflowInfo().workflowId

  // Message queue — signals push here, main loop processes
  const pendingMessages: string[] = []

  const state: DiscoveryState = {
    projectId,
    conversation: [],
    approved: false,
    hasMetrics: false,
    currentPhase: 'discovery',
  }

  workflow.setHandler(currentStateQuery, () => state)

  // Signals: synchronous state mutation only
  workflow.setHandler(userMessageSignal, (message: string) => {
    pendingMessages.push(message)
  })

  workflow.setHandler(approvePlanSignal, () => {
    state.approved = true
  })

  await dbUpsertProject(projectId, projectId, 'discovery', workflowId)

  // Main loop: process messages until approved or timeout
  while (!state.approved) {
    // Wait for a new message or approval
    await workflow.condition(() => pendingMessages.length > 0 || state.approved, '7 days')
    if (state.approved) break

    // Drain all pending messages (process the latest, acknowledge earlier ones)
    while (pendingMessages.length > 0) {
      const message = pendingMessages.shift()!
      state.conversation.push({ role: 'human', content: message, timestamp: new Date().toISOString() })

      const [ctx, cost] = await Promise.all([getContext(projectId), costSignal()])
      const systemPrompt = await buildPrompt(ctx)

      const conversationText = state.conversation
        .map(m => `${m.role === 'human' ? 'Human' : 'Agent'}: ${m.content}`)
        .join('\n')

      const reply = await llm(conversationText, 'discovery', 'medium', cost, systemPrompt)
      state.conversation.push({ role: 'agent', content: reply, timestamp: new Date().toISOString() })

      try {
        await metricsGate(projectId)
        state.hasMetrics = true
      } catch {
        state.hasMetrics = false
      }
    }
  }

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
