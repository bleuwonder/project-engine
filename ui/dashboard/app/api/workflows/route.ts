import { NextResponse } from 'next/server'
import type { DiscoveryState } from '@factory/types'
import { getTemporalClient } from '../../lib/temporal'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await getTemporalClient()
  const workflows = []

  for await (const wf of client.workflow.list({ query: 'ExecutionStatus="Running"' })) {
    try {
      const state = await client.workflow.getHandle(wf.workflowId).query<DiscoveryState>('currentState')
      workflows.push({ workflowId: wf.workflowId, startTime: wf.startTime, state })
    } catch {
      // workflow may not have currentState query — skip
    }
  }

  return NextResponse.json(workflows)
}
