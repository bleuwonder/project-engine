import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { RunFile } from '@factory/types'

const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? join(process.cwd(), '..', 'projects')

export async function readProjectFile(projectId: string, filename: string): Promise<string> {
  const path = join(PROJECTS_ROOT, projectId, filename)
  return readFile(path, 'utf-8').catch(() => '')
}

export async function writeProjectFile(
  projectId: string,
  filename: string,
  content: string,
): Promise<void> {
  const dir = join(PROJECTS_ROOT, projectId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), content, 'utf-8')
}

export async function writeRunFile(projectId: string, run: RunFile): Promise<void> {
  const filename = `runs/run-${run.runId}.md`
  const content = [
    `# Run: ${run.runId}`,
    `Date: ${run.startedAt.slice(0, 10)}`,
    `WorkflowID: ${run.workflowId}`,
    `Status: ${run.status}`,
    '',
    `## Agents spawned: ${run.agentsSpawned} / Completed: ${run.agentsCompleted} / Failed: ${run.agentsFailed}`,
    '',
    run.agentsFailed > 0
      ? `### Failed agents\n${run.failedAgents.map(a => `- ${a.agentId}: ${a.task} — ${a.reason}`).join('\n')}`
      : '',
    '',
    '### Findings',
    run.findings,
    '',
    '### Gaps',
    run.gaps,
  ]
    .filter(l => l !== undefined)
    .join('\n')

  await writeProjectFile(projectId, filename, content)
}

export async function readRecentRuns(projectId: string, limit = 5): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  const runsDir = join(PROJECTS_ROOT, projectId, 'runs')
  const files = await readdir(runsDir).catch(() => [] as string[])
  const recent = files.filter(f => f.endsWith('.md')).sort().reverse().slice(0, limit)
  return Promise.all(recent.map(f => readProjectFile(projectId, `runs/${f}`)))
}
