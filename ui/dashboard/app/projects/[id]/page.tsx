import type { DiscoveryState } from '@factory/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

interface RunRow {
  id: string
  workflow_id: string
  status: string
  agents_spawned: number
  agents_completed: number
  agents_failed: number
  started_at: string
  completed_at?: string
  cost_usd?: string
}

const STATUS_COLOR: Record<string, string> = {
  complete: '#10b981',
  partial_failure: '#f59e0b',
  failed: '#ef4444',
  running: '#3b82f6',
}

async function getProjectWorkflow(
  projectId: string,
): Promise<{ workflowId: string; state: DiscoveryState } | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'
  const res = await fetch(`${base}/api/workflows`, { next: { revalidate: 5 } })
  if (!res.ok) return null
  const workflows: Array<{ workflowId: string; state: DiscoveryState }> = await res.json()
  return workflows.find(wf => wf.state.projectId === projectId) ?? null
}

async function getRuns(projectId: string): Promise<RunRow[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'
  const res = await fetch(`${base}/api/runs/${projectId}`, { next: { revalidate: 5 } })
  if (!res.ok) return []
  return res.json()
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const [entry, runs] = await Promise.all([getProjectWorkflow(id), getRuns(id)])

  const totalCost = runs.reduce((sum, r) => sum + parseFloat(r.cost_usd ?? '0'), 0)

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <a href="/" style={{ color: '#6b7280', textDecoration: 'none' }}>← back</a>
      <h1 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>{id}</h1>

      {entry && (
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem' }}>
          {entry.workflowId} · phase: {entry.state.currentPhase} ·{' '}
          {entry.state.hasMetrics ? '✓ metrics' : '⚠ no metrics'} ·{' '}
          {entry.state.approved ? '✓ approved' : 'awaiting approval'}
        </p>
      )}

      {/* Conversation */}
      {entry && entry.state.conversation.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Discovery conversation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entry.state.conversation.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  background: msg.role === 'human' ? '#1e293b' : '#0f172a',
                  borderLeft: `3px solid ${msg.role === 'human' ? '#3b82f6' : '#10b981'}`,
                }}
              >
                <div style={{ color: msg.role === 'human' ? '#3b82f6' : '#10b981', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  {msg.role === 'human' ? 'Human' : 'Agent'} · {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Run history */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Run history</h2>
          {totalCost > 0 && (
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              Total cost: ${totalCost.toFixed(4)}
            </span>
          )}
        </div>

        {runs.length === 0 && (
          <p style={{ color: '#6b7280' }}>No runs yet.</p>
        )}

        {runs.map(run => (
          <div
            key={run.id}
            style={{
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem' }}>{run.id}</span>
              <span style={{ color: STATUS_COLOR[run.status] ?? '#6b7280', fontSize: '0.8rem' }}>
                {run.status}
              </span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {run.agents_completed}/{run.agents_spawned} agents ·{' '}
              {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
              {run.cost_usd ? ` · $${parseFloat(run.cost_usd).toFixed(4)}` : ''}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.15rem', wordBreak: 'break-all' }}>
              {run.workflow_id}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
