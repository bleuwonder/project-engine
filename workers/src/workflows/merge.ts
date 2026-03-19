import * as workflow from '@temporalio/workflow'
import type { MergeState } from '@factory/types'
import type { checkMetricsGate } from '../activities/metrics-gate.js'
import type { writeRunFile, writeProjectFile } from '../activities/git.js'
import type { upsertProject, insertRun } from '../activities/db-writes.js'
import type { mergePullRequest } from '../activities/github.js'
import type { gitCheckoutMain } from '../activities/git-ops.js'

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

const { mergePullRequest: mergePR } =
  workflow.proxyActivities<{ mergePullRequest: typeof mergePullRequest }>({
    startToCloseTimeout: '1m',
  })

const { gitCheckoutMain: checkoutMain } =
  workflow.proxyActivities<{ gitCheckoutMain: typeof gitCheckoutMain }>({
    startToCloseTimeout: '1m',
  })

export const currentStateQuery = workflow.defineQuery<MergeState>('currentState')

function isoNow(): string {
  return new Date(workflow.workflowInfo().unsafe.now()).toISOString()
}

export async function mergeWorkflow(
  projectId: string,
  branchName: string,
  prNumber: number,
): Promise<void> {
  const startedAt = isoNow()
  const workflowId = workflow.workflowInfo().workflowId

  await metricsGate(projectId)
  await dbUpsertProject(projectId, projectId, 'review', workflowId)

  const state: MergeState = {
    projectId,
    branchName,
    merged: false,
    currentPhase: 'complete',
  }

  workflow.setHandler(currentStateQuery, () => state)

  await mergePR(prNumber)
  state.merged = true

  const statusUpdate = [
    `# Status — ${projectId}`,
    '',
    `**Phase:** complete`,
    `**Last merged:** ${isoNow().slice(0, 10)}`,
    `**Branch merged:** \`${branchName}\``,
    `**PR #:** ${prNumber}`,
    '',
    '## Next Steps',
    'Project coding complete. Review outcomes and plan next phase.',
  ].join('\n')

  await writeFile(projectId, 'STATUS.md', statusUpdate)
  await checkoutMain()
  await dbUpsertProject(projectId, projectId, 'complete')

  const runId = `${projectId}-merge-${workflow.workflowInfo().unsafe.now()}`
  const runFile = {
    runId,
    workflowId,
    projectId,
    startedAt,
    completedAt: isoNow(),
    status: 'complete' as const,
    agentsSpawned: 0,
    agentsCompleted: 0,
    agentsFailed: 0,
    failedAgents: [],
    findings: `Merged PR #${prNumber} from \`${branchName}\` into main.`,
    gaps: '',
  }
  await Promise.all([writeRun(projectId, runFile), dbInsertRun(runFile)])
}
