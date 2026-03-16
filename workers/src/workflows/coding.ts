import * as workflow from '@temporalio/workflow'
import type { CodingState, TaskItem } from '@factory/types'
import type { prepareAgentContext, buildSystemPrompt } from '../activities/context.js'
import type { routeToModel } from '../activities/llm.js'
import type { getCostSignal } from '../activities/cost-oracle.js'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile, writeProjectFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'
import type { gitCreateBranch, gitCommitFiles, gitPushBranch } from '../activities/git-ops.js'
import type { runTestSuite } from '../activities/test-runner.js'

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

  let agentsCompleted = 0
  let agentsFailed = 0
  const failedAgents: Array<{ agentId: string; task: string; reason: string; retriesExhausted: boolean }> = []

  // Run each task sequentially
  for (let i = 0; i < state.tasks.length; i++) {
    state.currentTaskIndex = i
    const task = state.tasks[i]
    state.tasks[i] = { ...task, status: 'in_progress' }

    const [ctx, cost] = await Promise.all([getContext(projectId), costSignal()])
    const systemPrompt = await buildPrompt(ctx)

    let taskPassed = false
    let lastError = ''

    // Up to 3 attempts per task (retry with error feedback)
    for (let attempt = 0; attempt < 3; attempt++) {
      const prompt = attempt === 0
        ? [
            `Implement the following coding task for project ${projectId}:`,
            '',
            `Task: ${task.description}`,
            `Requirements: ${task.requirements}`,
            `Output file(s): ${task.outputFiles.join(', ')}`,
            '',
            'Output ONLY the file content. No explanations. If multiple files, separate each with:',
            '===FILE: path/to/file.ts===',
            '[file content]',
          ].join('\n')
        : [
            `Previous attempt failed with error:`,
            lastError,
            '',
            `Fix the implementation for: ${task.description}`,
            `Output file(s): ${task.outputFiles.join(', ')}`,
          ].join('\n')

      const code = await llm(prompt, 'code', 'medium', cost, systemPrompt)

      // Parse and write output files
      if (task.outputFiles.length === 1) {
        await writeFile(projectId, task.outputFiles[0], code)
      } else {
        // Multi-file response: split on ===FILE: path=== markers
        const fileBlocks = code.split(/===FILE:\s*(.+?)===/)
        for (let j = 1; j < fileBlocks.length; j += 2) {
          const filePath = fileBlocks[j].trim()
          const fileContent = fileBlocks[j + 1]?.trim() ?? ''
          if (filePath && fileContent) {
            await writeFile(projectId, filePath, fileContent)
          }
        }
      }

      const commitMsg = `feat(${projectId}): ${task.description} [task ${i + 1}/${state.tasks.length}]`
      const filePaths = task.outputFiles.map(f => `projects/${projectId}/${f}`)
      await commitFiles(commitMsg, filePaths)

      // Run tests after each task
      const testResult = await runTests(projectId)
      state.testOutput = testResult.output

      if (testResult.passed) {
        taskPassed = true
        break
      }
      lastError = testResult.output.slice(-2000)
    }

    if (taskPassed) {
      state.tasks[i] = { ...state.tasks[i], status: 'done' }
      agentsCompleted++
    } else {
      state.tasks[i] = { ...state.tasks[i], status: 'failed' }
      agentsFailed++
      failedAgents.push({
        agentId: `task-${task.id}`,
        task: task.description,
        reason: `Tests failed after 3 attempts: ${lastError.slice(0, 500)}`,
        retriesExhausted: true,
      })
    }
  }

  state.testsPassed = agentsFailed === 0

  // Push branch
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
