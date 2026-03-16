import { NextResponse } from 'next/server'
import { getTemporalClient } from '../../lib/temporal'
import { currentStateQuery } from '../../../../../workers/src/workflows/index'

export const revalidate = 5

export async function GET() {
  const client = await getTemporalClient()
  const workflows = []

  for await (const wf of client.workflow.list({ query: 'ExecutionStatus="Running"' })) {
    try {
      const state = await client.workflow.getHandle(wf.workflowId).query(currentStateQuery)
      workflows.push({ workflowId: wf.workflowId, startTime: wf.startTime, state })
    } catch {
      // workflow may not have currentState query — skip
    }
  }

  return NextResponse.json(workflows)
}
