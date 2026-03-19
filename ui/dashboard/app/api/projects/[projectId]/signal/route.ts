import { NextResponse } from 'next/server'
import { getTemporalClient } from '../../../../lib/temporal'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { action, message } = await req.json()

  const client = await getTemporalClient()

  switch (action) {
    case 'message':
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'message required' }, { status: 400 })
      }
      await client.workflow.getHandle(`${projectId}-discovery`).signal('userMessage', message)
      break

    case 'approve':
      await client.workflow.getHandle(`${projectId}-discovery`).signal('approvePlan')
      break

    case 'approve-pr':
      await client.workflow.getHandle(`${projectId}-review`).signal('approvePR')
      break

    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
