import type { DiscoveryState, ReviewState, CodingState } from '@factory/types'
import ProjectActions from '../../components/ProjectActions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

interface ProjectRow {
  id: string
  name: string
  phase: string
  active_workflow_id: string | null
  updated_at: string
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

const PHASE_COLOR: Record<string, string> = {
  discovery: '#3b82f6',
  planning: '#8b5cf6',
  building: '#f59e0b',
  coding: '#f59e0b',
  review: '#06b6d4',
  merge: '#06b6d4',
  complete: '#10b981',
  failed: '#ef4444',
}

const INTERNAL_BASE = `http://localhost:${process.env.PORT ?? '3100'}`

async function getProject(id: string): Promise<ProjectRow | null> {
  const res = await fetch(`${INTERNAL_BASE}/api/projects`, { next: { revalidate: 5 } })
  if (!res.ok) return null
  const projects: ProjectRow[] = await res.json()
  return projects.find(p => p.id === id) ?? null
}

async function getRuns(projectId: string): Promise<RunRow[]> {
  const res = await fetch(`${INTERNAL_BASE}/api/runs/${projectId}`, { next: { revalidate: 5 } })
  if (!res.ok) return []
  return res.json()
}

async function getLiveState(projectId: string): Promise<{
  discovery?: DiscoveryState
  coding?: CodingState
  review?: ReviewState
} | null> {
  const res = await fetch(`${INTERNAL_BASE}/api/state/${projectId}`, { next: { revalidate: 5 } })
  if (!res.ok) return null
  return res.json()
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const [project, runs, live] = await Promise.all([
    getProject(id),
    getRuns(id),
    getLiveState(id),
  ])

  const totalCost = runs.reduce((sum, r) => sum + parseFloat(r.cost_usd ?? '0'), 0)

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <a href="/" style={{ color: '#6b7280', textDecoration: 'none' }}>← back</a>
      <h1 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>{id}</h1>

      {project && (
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2rem' }}>
          phase:{' '}
          <span style={{ color: PHASE_COLOR[project.phase] ?? '#6b7280' }}>
            {project.phase}
          </span>
          {' · '}updated {new Date(project.updated_at).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      {project && (
        <ProjectActions
          projectId={id}
          phase={project.phase}
          discoveryApproved={live?.discovery?.approved}
          reviewApproved={live?.review?.approved}
        />
      )}

      {/* Live coding state */}
      {live?.coding && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Coding progress</h2>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Branch: <code>{live.coding.branchName}</code> · Task {live.coding.currentTaskIndex + 1}/{live.coding.tasks.length}
            {live.coding.testsPassed ? ' · ✓ tests passed' : ''}
          </div>
          {live.coding.tasks.map((t, i) => (
            <div key={t.id} style={{
              padding: '0.5rem 0.75rem',
              borderLeft: `3px solid ${t.status === 'done' ? '#10b981' : t.status === 'in_progress' ? '#3b82f6' : t.status === 'failed' ? '#ef4444' : '#374151'}`,
              marginBottom: '0.25rem',
              fontSize: '0.85rem',
            }}>
              <span style={{ color: '#6b7280' }}>{i + 1}.</span> {t.description}
              <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>[{t.status}]</span>
            </div>
          ))}
        </section>
      )}

      {/* Live review state */}
      {live?.review && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Review</h2>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {live.review.prUrl ? (
              <a href={live.review.prUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                PR #{live.review.prNumber}
              </a>
            ) : 'PR not yet created'}
            {live.review.approved ? ' · ✓ approved' : ' · awaiting approval'}
          </div>
          {live.review.findings && (
            <pre style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto' }}>
              {live.review.findings}
            </pre>
          )}
        </section>
      )}

      {/* Discovery conversation */}
      {live?.discovery && live.discovery.conversation.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Discovery conversation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {live.discovery.conversation.map((msg, i) => (
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
