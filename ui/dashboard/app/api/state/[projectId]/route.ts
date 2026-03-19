import { NextResponse } from 'next/server'
import type { DiscoveryState, CodingState, ReviewState } from '@factory/types'
import { getTemporalClient } from '../../../lib/temporal'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const client = await getTemporalClient()

  const result: {
    discovery?: DiscoveryState
    coding?: CodingState
    review?: ReviewState
  } = {}

  // Query child workflows by deterministic ID — silently skip if not running
  const queries: Array<{ key: keyof typeof result; childId: string; query: string }> = [
    { key: 'discovery', childId: `${projectId}-discovery`, query: 'currentState' },
    { key: 'coding', childId: `${projectId}-coding`, query: 'currentState' },
    { key: 'review', childId: `${projectId}-review`, query: 'currentState' },
  ]

  await Promise.all(
    queries.map(async ({ key, childId, query }) => {
      try {
        const state = await client.workflow.getHandle(childId).query(query)
        ;(result as Record<string, unknown>)[key] = state
      } catch { /* child not running or already completed */ }
    }),
  )

  return NextResponse.json(result)
}
