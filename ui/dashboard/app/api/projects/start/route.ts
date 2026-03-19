import { NextResponse } from 'next/server'
import { getTemporalClient } from '../../../lib/temporal'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { projectId } = await req.json()
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const client = await getTemporalClient()
  const handle = await client.workflow.start('ProjectWorkflow', {
    taskQueue: 'factory',
    workflowId: projectId,
    args: [projectId],
  })

  return NextResponse.json({ workflowId: handle.workflowId })
}
