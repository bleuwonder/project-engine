import type { DiscoveryState } from '@factory/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface WorkflowEntry {
  workflowId: string
  startTime: string
  state: DiscoveryState
}

const PHASE_COLOR: Record<string, string> = {
  discovery: '#3b82f6',
  planning: '#8b5cf6',
  building: '#f59e0b',
  review: '#06b6d4',
  complete: '#10b981',
  failed: '#ef4444',
}

async function getWorkflows(): Promise<WorkflowEntry[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'
  const res = await fetch(`${base}/api/workflows`, { next: { revalidate: 5 } })
  if (!res.ok) return []
  return res.json()
}

export default async function Dashboard() {
  const workflows = await getWorkflows()

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Factory</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} running
      </p>

      {workflows.length === 0 && (
        <p style={{ color: '#6b7280' }}>No active workflows. Start a project via the Claude plugin.</p>
      )}

      {workflows.map(wf => (
        <Link
          key={wf.workflowId}
          href={`/projects/${wf.state.projectId}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            style={{
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '1rem 1.25rem',
              marginBottom: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{wf.state.projectId}</strong>
              <span
                style={{
                  color: PHASE_COLOR[wf.state.currentPhase] ?? '#6b7280',
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {wf.state.currentPhase}
              </span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {wf.workflowId} · {wf.state.conversation.length} messages ·{' '}
              {wf.state.hasMetrics ? '✓ metrics' : '⚠ no metrics'} ·{' '}
              {wf.state.approved ? '✓ approved' : 'awaiting approval'}
            </div>
          </div>
        </Link>
      ))}
    </main>
  )
}
