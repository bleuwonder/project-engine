import Link from 'next/link'
import StartProjectForm from './components/StartProjectForm'

export const dynamic = 'force-dynamic'

interface ProjectRow {
  id: string
  name: string
  phase: string
  active_workflow_id: string | null
  updated_at: string
  last_run_status: string | null
  last_run_cost: string | null
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

async function getProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${INTERNAL_BASE}/api/projects`, { next: { revalidate: 5 } })
  if (!res.ok) return []
  return res.json()
}

export default async function Dashboard() {
  const projects = await getProjects()
  const active = projects.filter(p => p.phase !== 'complete' && p.phase !== 'failed')
  const done = projects.filter(p => p.phase === 'complete' || p.phase === 'failed')

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Factory</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        {active.length} active · {done.length} completed
      </p>

      <StartProjectForm />

      {projects.length === 0 && (
        <p style={{ color: '#6b7280' }}>No projects yet. Start one above.</p>
      )}

      {active.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Active</h2>
          {active.map(p => <ProjectCard key={p.id} project={p} />)}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Completed</h2>
          {done.map(p => <ProjectCard key={p.id} project={p} />)}
        </section>
      )}
    </main>
  )
}

function ProjectCard({ project: p }: { project: ProjectRow }) {
  return (
    <Link href={`/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '1rem 1.25rem',
        marginBottom: '0.75rem',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{p.name}</strong>
          <span style={{
            color: PHASE_COLOR[p.phase] ?? '#6b7280',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {p.phase}
          </span>
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          updated {new Date(p.updated_at).toLocaleString()}
          {p.last_run_status ? ` · last run: ${p.last_run_status}` : ''}
          {p.last_run_cost ? ` · $${parseFloat(p.last_run_cost).toFixed(4)}` : ''}
        </div>
      </div>
    </Link>
  )
}
