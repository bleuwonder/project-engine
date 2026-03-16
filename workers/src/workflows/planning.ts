import * as workflow from '@temporalio/workflow'
import type { PlanningState, TaskItem } from '@factory/types'
import type { prepareAgentContext, buildSystemPrompt } from '../activities/context.js'
import type { routeToModel } from '../activities/llm.js'
import type { getCostSignal } from '../activities/cost-oracle.js'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile, writeProjectFile } from '../activities/git.js'
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

const { writeRunFile: writeRun, writeProjectFile: writeFile } =
  workflow.proxyActivities<{
    writeRunFile: typeof writeRunFile
    writeProjectFile: typeof writeProjectFile
  }>({ startToCloseTimeout: '30s' })

const { upsertProject: dbUpsertProject, insertRun: dbInsertRun } =
  workflow.proxyActivities<{
    upsertProject: typeof upsertProject
    insertRun: typeof insertRun
  }>({ startToCloseTimeout: '15s' })

export const approvePlanSignal = workflow.defineSignal<[]>('approvePlan')
export const currentStateQuery = workflow.defineQuery<PlanningState>('currentState')

export async function planningWorkflow(projectId: string): Promise<void> {
  const startedAt = new Date().toISOString()
  const workflowId = workflow.workflowInfo().workflowId

  await metricsGate(projectId)
  await dbUpsertProject(projectId, projectId, 'planning', workflowId)

  const state: PlanningState = {
    projectId,
    architecture: '',
    tasks: [],
    approved: false,
    currentPhase: 'planning',
  }

  workflow.setHandler(currentStateQuery, () => state)
  workflow.setHandler(approvePlanSignal, () => { state.approved = true })

  const [ctx, cost] = await Promise.all([getContext(projectId), costSignal()])
  const systemPrompt = await buildPrompt(ctx)

  const planResponse = await llm(
    [
      'Based on the project goals and existing context, produce a technical plan.',
      '',
      'Format your response exactly as:',
      '---ARCHITECTURE---',
      '[Write ARCHITECTURE.md content here — technical approach, stack decisions, key components]',
      '---TASKS---',
      '[Write a JSON array of coding tasks. Each item: {"id":"t1","description":"...","outputFiles":["src/foo.ts"],"requirements":"..."}]',
    ].join('\n'),
    'planning',
    'complex',
    cost,
    systemPrompt,
  )

  // Parse architecture and tasks from response
  const archMatch = planResponse.match(/---ARCHITECTURE---([\s\S]*?)---TASKS---/)
  const tasksMatch = planResponse.match(/---TASKS---([\s\S]*)$/)

  state.architecture = archMatch?.[1]?.trim() ?? planResponse

  try {
    const jsonText = tasksMatch?.[1]?.trim() ?? '[]'
    // Strip markdown code fences if present
    const stripped = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const rawTasks: Array<Omit<TaskItem, 'status'>> = JSON.parse(stripped)
    state.tasks = rawTasks.map(t => ({ ...t, status: 'pending' as const }))
  } catch {
    state.tasks = []
  }

  await writeFile(projectId, 'ARCHITECTURE.md', state.architecture)
  await writeFile(
    projectId,
    'AGENT_INSTRUCTIONS.md',
    [
      '# Coding Tasks',
      '',
      ...state.tasks.map(
        (t, i) => `## Task ${i + 1}: ${t.description}\n\nOutput files: ${t.outputFiles.join(', ')}\n\n${t.requirements}`,
      ),
    ].join('\n\n'),
  )

  // Wait for human approval (up to 7 days)
  await workflow.condition(() => state.approved, '7 days')

  const runId = `${projectId}-planning-${Date.now()}`
  const runFile = {
    runId,
    workflowId,
    projectId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: 'complete' as const,
    agentsSpawned: 1,
    agentsCompleted: 1,
    agentsFailed: 0,
    failedAgents: [],
    findings: `Architecture defined. ${state.tasks.length} coding tasks planned.`,
    gaps: '',
  }
  await Promise.all([writeRun(projectId, runFile), dbInsertRun(runFile)])
}
