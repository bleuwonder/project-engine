import { NextResponse } from 'next/server'
import postgres from 'postgres'

export const dynamic = 'force-dynamic'

const sql = postgres(process.env.DATABASE_URL!)

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const runs = await sql`
    SELECT id, project_id, workflow_id, status,
           agents_spawned, agents_completed, agents_failed,
           started_at, completed_at, cost_usd
    FROM runs
    WHERE project_id = ${projectId}
    ORDER BY started_at DESC
    LIMIT 20
  `
  return NextResponse.json(runs)
}
