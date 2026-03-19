'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StartProjectForm() {
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = projectId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!id) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setProjectId('')
      router.push(`/projects/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
      <input
        type="text"
        value={projectId}
        onChange={e => setProjectId(e.target.value)}
        placeholder="project-id"
        disabled={loading}
        style={{
          background: '#1e293b',
          border: '1px solid #374151',
          borderRadius: '4px',
          color: '#f1f5f9',
          padding: '0.5rem 0.75rem',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          flex: 1,
        }}
      />
      <button
        type="submit"
        disabled={loading || !projectId.trim()}
        style={{
          background: '#3b82f6',
          border: 'none',
          borderRadius: '4px',
          color: '#fff',
          padding: '0.5rem 1rem',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !projectId.trim() ? 0.5 : 1,
        }}
      >
        {loading ? '...' : 'Start Project'}
      </button>
      {error && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</span>}
    </form>
  )
}
