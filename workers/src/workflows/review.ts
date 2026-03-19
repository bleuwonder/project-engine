import * as workflow from '@temporalio/workflow'
import type { ReviewState } from '@factory/types'
import type { prepareAgentContext, buildSystemPrompt } from '../activities/context.js'
import type { routeToModel } from '../activities/llm.js'
import type { getCostSignal } from '../activities/cost-oracle.js'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile, writeProjectFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'
import type { createPullRequest } from '../activities/github.js'

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

const { createPullRequest: openPR } =
  workflow.proxyActivities<{ createPullRequest: typeof createPullRequest }>({
    startToCloseTimeout: '1m',
  })

export const approvePRSignal = workflow.defineSignal<[]>('approvePR')
export const currentStateQuery = workflow.defineQuery<ReviewState>('currentState')

function isoNow(): string {
  return new Date(workflow.workflowInfo().unsafe.now()).toISOString()
}

export async function reviewWorkflow(
  projectId: string,
  branchName: string,
  codingRunId: string,
): Promise<{ branchName: string, prNumber: number }> {
  const startedAt = isoNow()
  const workflowId = workflow.workflowInfo().workflowId

  await metricsGate(projectId)
  await dbUpsertProject(projectId, projectId, 'review', workflowId)

  const state: ReviewState = {
    projectId,
    branchName,
    prUrl: '',
    prNumber: 0,
    findings: '',
    approved: false,
    currentPhase: 'review',
  }

  workflow.setHandler(currentStateQuery, () => state)
  workflow.setHandler(approvePRSignal, () => { state.approved = true })

  // Automated code review
  const [ctx, cost] = await Promise.all([getContext(projectId), costSignal()])
  const systemPrompt = await buildPrompt(ctx)

  const reviewPrompt = [
    `Review the code changes on branch \`${branchName}\` for project ${projectId}.`,
    '',
    'Provide a structured code review covering:',
    '1. Correctness and logic',
    '2. Security concerns',
    '3. Performance considerations',
    '4. Code quality and maintainability',
    '5. Missing tests or edge cases',
    '',
    'Be specific. Cite file names and line patterns where applicable.',
  ].join('\n')

  state.findings = await llm(reviewPrompt, 'review', 'medium', cost, systemPrompt)
  await writeFile(projectId, 'REVIEW.md', `# Code Review — ${branchName}\n\n${state.findings}`)

  // Create GitHub PR
  const prBody = [
    `## Summary`,
    `Automated coding run \`${codingRunId}\` for project \`${projectId}\`.`,
    '',
    `## Code Review Findings`,
    state.findings,
    '',
    `## Review Workflow ID`,
    workflowId,
  ].join('\n')

  const { prUrl, prNumber } = await openPR(
    branchName,
    `feat(${projectId}): coding run ${codingRunId}`,
    prBody,
  )
  state.prUrl = prUrl
  state.prNumber = prNumber

  // Wait for human to approve PR (7 days)
  await workflow.condition(() => state.approved, '7 days')

  const runId = `${projectId}-review-${workflow.workflowInfo().unsafe.now()}`
  const runFile = {
    runId,
    workflowId,
    projectId,
    startedAt,
    completedAt: isoNow(),
    status: 'complete' as const,
    agentsSpawned: 1,
    agentsCompleted: 1,
    agentsFailed: 0,
    failedAgents: [],
    findings: `PR #${prNumber}: ${prUrl}\n\n${state.findings.slice(0, 2000)}`,
    gaps: '',
  }
  await Promise.all([writeRun(projectId, runFile), dbInsertRun(runFile)])
  return { branchName: state.branchName, prNumber: state.prNumber }
}
