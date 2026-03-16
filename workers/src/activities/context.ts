import { readProjectFile, readRecentRuns } from './git.js'

export interface SystemContext {
  goals: string
  architecture: string
  instructions: string
  recentRuns: string[]
}

export async function prepareAgentContext(projectId: string): Promise<SystemContext> {
  const [goals, architecture, instructions, recentRuns] = await Promise.all([
    readProjectFile(projectId, 'GOALS.md'),
    readProjectFile(projectId, 'ARCHITECTURE.md'),
    readProjectFile(projectId, 'AGENT_INSTRUCTIONS.md'),
    readRecentRuns(projectId, 5),
  ])

  return { goals, architecture, instructions, recentRuns }
}

export async function buildSystemPrompt(ctx: SystemContext): Promise<string> {
  return [
    '# Project Context',
    '',
    '## Goals',
    ctx.goals || '(not yet defined)',
    '',
    '## Architecture',
    ctx.architecture || '(not yet defined)',
    '',
    '## Instructions',
    ctx.instructions || '(not yet defined)',
    '',
    ctx.recentRuns.length > 0
      ? `## Recent Runs\n${ctx.recentRuns.map((r, i) => `### Run ${i + 1}\n${r}`).join('\n\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}
