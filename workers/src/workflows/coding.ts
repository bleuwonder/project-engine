import * as workflow from '@temporalio/workflow'
import { join } from 'path'
import type { CodingState, TaskItem } from '@factory/types'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'
import type { gitCreateBranch, gitCommitFiles, gitPushBranch } from '../activities/git-ops.js'
import type { runTestSuite } from '../activities/test-runner.js'
import type { claudeCodingAgent } from '../activities/claude-agent.js'

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

const { gitCreateBranch: createBranch, gitCommitFiles: commitFiles, gitPushBranch: pushBranch } =
  workflow.proxyActivities<{
    gitCreateBranch: typeof gitCreateBranch
    gitCommitFiles: typeof gitCommitFiles
    gitPushBranch: typeof gitPushBranch
  }>({ startToCloseTimeout: '2m' })

const { runTestSuite: runTests } =
  workflow.proxyActivities<{ runTestSuite: typeof runTestSuite }>({
    startToCloseTimeout: '3m',
  })

const { claudeCodingAgent: runCodingAgent } =
  workflow.proxyActivities<{ claudeCodingAgent: typeof claudeCodingAgent }>({
    startToCloseTimeout: '10m',
    retry: { maximumAttempts: 2 },
  })

export const currentStateQuery = workflow.defineQuery<CodingState>('currentState')

export async function codingWorkflow(projectId: string, tasks: TaskItem[]): Promise<void> {
  const startedAt = new Date().toISOString()
  const workflowId = workflow.workflowInfo().workflowId
  const branchName = `project/${projectId}/coding/${workflowId.slice(-8)}`

  await metricsGate(projectId)
  await dbUpsertProject(projectId, projectId, 'building', workflowId)

  const state: CodingState = {
    projectId,
    branchName,
    tasks: tasks.map(t => ({ ...t, status: 'pending' as const })),
    currentTaskIndex: 0,
    testsPassed: false,
    testOutput: '',
    currentPhase: 'building',
  }

  workflow.setHandler(currentStateQuery, () => state)

  await createBranch(branchName)

  const projectsRoot = process.env.PROJECTS_ROOT ?? '/workspace/projects'
  const projectDir = join(projectsRoot, projectId)

  let agentsCompleted = 0
  let agentsFailed = 0
  const failedAgents: Array<{ agentId: string; task: string; reason: string; retriesExhausted: boolean }> = []

  for (let i = 0; i < state.tasks.length; i++) {
    state.currentTaskIndex = i
    const task = state.tasks[i]
    state.tasks[i] = { ...task, status: 'in_progress' }

    try {
      // Claude Code agent writes files directly — no parsing needed
      const summary = await runCodingAgent(projectDir, task.description, task.outputFiles)
      state.tasks[i] = { ...state.tasks[i], status: 'done', agentOutput: summary }

      const commitMsg = `feat(${projectId}): ${task.description} [${i + 1}/${state.tasks.length}]`
      const filePaths = task.outputFiles.map(f => `projects/${projectId}/${f}`)
      await commitFiles(commitMsg, filePaths)

      agentsCompleted++
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 500) : String(err)
      state.tasks[i] = { ...state.tasks[i], status: 'failed' }
      agentsFailed++
      failedAgents.push({
        agentId: `task-${task.id}`,
        task: task.description,
        reason,
        retriesExhausted: true,
      })
    }
  }

  // Run test suite after all tasks
  const testResult = await runTests(projectId)
  state.testsPassed = testResult.passed
  state.testOutput = testResult.output

  await pushBranch(branchName)

  const runStatus = agentsFailed === 0 ? 'complete' as const
    : agentsCompleted > 0 ? 'partial_failure' as const
    : 'failed' as const

  const runId = `${projectId}-coding-${Date.now()}`
  const runFile = {
    runId,
    workflowId,
    projectId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: runStatus,
    agentsSpawned: state.tasks.length,
    agentsCompleted,
    agentsFailed,
    failedAgents,
    findings: `Branch: ${branchName}\n\nCompleted ${agentsCompleted}/${state.tasks.length} tasks.\n\nTest output:\n${state.testOutput.slice(0, 2000)}`,
    gaps: agentsFailed > 0
      ? failedAgents.map(a => `- ${a.task}: ${a.reason}`).join('\n')
      : '',
  }
  await Promise.all([writeRun(projectId, runFile), dbInsertRun(runFile)])
}
