#!/usr/bin/env node
import { program } from 'commander'
import { Client, Connection } from '@temporalio/client'

let _client: Client | null = null

async function getClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    })
    _client = new Client({ connection })
  }
  return _client
}

interface ProjectState {
  projectId: string
  phase: string
  childIds: Record<string, string>
}

interface DiscoveryState {
  projectId: string
  conversation: Array<{ role: string; content: string; timestamp: string }>
  approved: boolean
  hasMetrics: boolean
  currentPhase: string
}

interface CodingState {
  projectId: string
  branchName: string
  tasks: Array<{ id: string; description: string; status: string }>
  currentTaskIndex: number
  testsPassed: boolean
  currentPhase: string
}

interface ReviewState {
  projectId: string
  branchName: string
  prUrl: string
  prNumber: number
  approved: boolean
  currentPhase: string
}

program
  .name('factory')
  .description('AI Build Factory CLI')
  .version('0.0.1')

program
  .command('start')
  .argument('<projectId>', 'project identifier')
  .description('Start a new ProjectWorkflow')
  .action(async (projectId: string) => {
    const client = await getClient()
    const handle = await client.workflow.start('ProjectWorkflow', {
      taskQueue: 'factory',
      workflowId: projectId,
      args: [projectId],
    })
    console.log(`started ${handle.workflowId}`)
    process.exit(0)
  })

program
  .command('msg')
  .argument('<projectId>', 'project identifier')
  .argument('<message>', 'message to send')
  .description('Send a message during discovery phase')
  .action(async (projectId: string, message: string) => {
    const client = await getClient()
    await client.workflow.getHandle(`${projectId}-discovery`).signal('userMessage', message)
    console.log(`sent message to ${projectId}-discovery`)
    process.exit(0)
  })

program
  .command('approve')
  .argument('<projectId>', 'project identifier')
  .description('Approve the plan (discovery phase)')
  .action(async (projectId: string) => {
    const client = await getClient()
    await client.workflow.getHandle(`${projectId}-discovery`).signal('approvePlan')
    console.log(`approved plan for ${projectId}`)
    process.exit(0)
  })

program
  .command('approve-pr')
  .argument('<projectId>', 'project identifier')
  .description('Approve the PR (review phase)')
  .action(async (projectId: string) => {
    const client = await getClient()
    await client.workflow.getHandle(`${projectId}-review`).signal('approvePR')
    console.log(`approved PR for ${projectId}`)
    process.exit(0)
  })

program
  .command('status')
  .argument('<projectId>', 'project identifier')
  .description('Show current project state')
  .action(async (projectId: string) => {
    const client = await getClient()

    // Try ProjectWorkflow first
    let phase = 'unknown'
    try {
      const state = await client.workflow.getHandle(projectId).query<ProjectState>('projectState')
      phase = state.phase
      console.log(`project: ${projectId}`)
      console.log(`phase:   ${phase}`)
    } catch {
      // Not a running ProjectWorkflow — check DB phase via describe
      try {
        const desc = await client.workflow.getHandle(projectId).describe()
        console.log(`project: ${projectId}`)
        console.log(`status:  ${desc.status.name}`)
      } catch {
        console.log(`project: ${projectId}`)
        console.log(`status:  no active workflow`)
      }
    }

    // Query active child for details
    if (phase === 'discovery') {
      try {
        const s = await client.workflow.getHandle(`${projectId}-discovery`).query<DiscoveryState>('currentState')
        console.log(`msgs:    ${s.conversation.length}`)
        console.log(`metrics: ${s.hasMetrics ? 'yes' : 'no'}`)
        console.log(`approved:${s.approved ? ' yes' : ' no'}`)
        if (s.conversation.length > 0) {
          const last = s.conversation[s.conversation.length - 1]
          console.log(`\nlast ${last.role}: ${last.content.slice(0, 200)}`)
        }
      } catch { /* child not queryable */ }
    } else if (phase === 'planning') {
      try {
        const s = await client.workflow.getHandle(`${projectId}-planning`).query('currentState') as { tasks: Array<{ description: string }>; approved: boolean }
        console.log(`tasks:   ${s.tasks.length}`)
        console.log(`approved:${s.approved ? ' yes' : ' no'}`)
      } catch { /* */ }
    } else if (phase === 'coding') {
      try {
        const s = await client.workflow.getHandle(`${projectId}-coding`).query<CodingState>('currentState')
        console.log(`branch:  ${s.branchName}`)
        console.log(`task:    ${s.currentTaskIndex + 1}/${s.tasks.length}`)
        console.log(`tests:   ${s.testsPassed ? 'passed' : 'pending'}`)
      } catch { /* */ }
    } else if (phase === 'review') {
      try {
        const s = await client.workflow.getHandle(`${projectId}-review`).query<ReviewState>('currentState')
        console.log(`pr:      ${s.prUrl || 'pending'}`)
        console.log(`approved:${s.approved ? ' yes' : ' no'}`)
      } catch { /* */ }
    }

    process.exit(0)
  })

program
  .command('list')
  .description('List all projects')
  .action(async () => {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3100'
    try {
      const res = await fetch(`${dashboardUrl}/api/projects`)
      const projects: Array<{ id: string; phase: string; updated_at: string }> = await res.json()
      if (projects.length === 0) {
        console.log('no projects')
      } else {
        const maxId = Math.max(...projects.map(p => p.id.length), 2)
        for (const p of projects) {
          const date = new Date(p.updated_at).toLocaleDateString()
          console.log(`${p.id.padEnd(maxId)}  ${p.phase.padEnd(10)}  ${date}`)
        }
      }
    } catch {
      console.error('could not reach dashboard at', dashboardUrl)
      console.error('set DASHBOARD_URL env var or ensure dashboard is running')
    }
    process.exit(0)
  })

program.parseAsync().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
