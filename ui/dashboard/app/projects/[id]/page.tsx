import type { DiscoveryState } from '@factory/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

async function getProjectWorkflow(projectId: string): Promise<{ workflowId: string; state: DiscoveryState } | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3100'
  const res = await fetch(`${base}/api/workflows`, { next: { revalidate: 5 } })
  if (!res.ok) return null
  const workflows: Array<{ workflowId: string; state: DiscoveryState }> = await res.json()
  return workflows.find(wf => wf.state.projectId === projectId) ?? null
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const entry = await getProjectWorkflow(id)

  if (!entry) {
    return (
      <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
        <a href="/" style={{ color: '#6b7280' }}>← back</a>
        <h1 style={{ marginTop: '1rem' }}>{id}</h1>
        <p style={{ color: '#6b7280' }}>No active workflow found.</p>
      </main>
    )
  }

  const { state } = entry

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <a href="/" style={{ color: '#6b7280', textDecoration: 'none' }}>← back</a>
      <h1 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>{id}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem' }}>
        {entry.workflowId} · phase: {state.currentPhase} ·{' '}
        {state.hasMetrics ? '✓ metrics' : '⚠ no metrics'} ·{' '}
        {state.approved ? '✓ approved' : 'awaiting approval'}
      </p>

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Conversation</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {state.conversation.map((msg, i) => (
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
        {state.conversation.length === 0 && (
          <p style={{ color: '#6b7280' }}>No messages yet.</p>
        )}
      </div>
    </main>
  )
}
