import { NextResponse } from 'next/server'
import { getTemporalClient } from '../../lib/temporal'

export const dynamic = 'force-dynamic'

interface ProjectState {
  projectId: string
  phase: string
  childIds: Record<string, string>
}

export async function GET() {
  const client = await getTemporalClient()
  const workflows = []

  for await (const wf of client.workflow.list({ query: 'ExecutionStatus="Running"' })) {
    try {
      // Try ProjectWorkflow query first
      const state = await client.workflow.getHandle(wf.workflowId).query<ProjectState>('projectState')
      workflows.push({ workflowId: wf.workflowId, startTime: wf.startTime, type: 'project', state })
      continue
    } catch { /* not a ProjectWorkflow */ }

    try {
      // Fall back to child workflow currentState query
      const state = await client.workflow.getHandle(wf.workflowId).query('currentState')
      workflows.push({ workflowId: wf.workflowId, startTime: wf.startTime, type: 'phase', state })
    } catch { /* skip workflows without queryable state */ }
  }

  return NextResponse.json(workflows)
}
