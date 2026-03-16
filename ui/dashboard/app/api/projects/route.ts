import { NextResponse } from 'next/server'
import postgres from 'postgres'

export const dynamic = 'force-dynamic'

const sql = postgres(process.env.DATABASE_URL!)

export async function GET() {
  const projects = await sql`
    SELECT p.*, r.status as last_run_status, r.cost_usd as last_run_cost
    FROM projects p
    LEFT JOIN runs r ON r.id = p.last_run_id
    ORDER BY p.updated_at DESC
    LIMIT 50
  `
  return NextResponse.json(projects)
}
