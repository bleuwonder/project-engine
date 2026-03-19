'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  phase: string
  discoveryApproved?: boolean
  reviewApproved?: boolean
}

export default function ProjectActions({ projectId, phase, discoveryApproved, reviewApproved }: Props) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const router = useRouter()

  async function signal(action: string, msg?: string) {
    setLoading(true)
    setFeedback('')
    try {
      const res = await fetch(`/api/projects/${projectId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: msg }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setFeedback(action === 'message' ? 'sent' : 'done')
      setMessage('')
      setTimeout(() => router.refresh(), 1000)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#1e293b',
    border: '1px solid #374151',
    borderRadius: '4px',
    color: '#f1f5f9',
    padding: '0.5rem 0.75rem',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    flex: 1,
  } as const

  const btnStyle = (color: string) => ({
    background: color,
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    padding: '0.5rem 1rem',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.5 : 1,
  }) as const

  // Discovery phase: message input + approve button
  if (phase === 'discovery') {
    return (
      <div style={{ marginBottom: '2rem', borderTop: '1px solid #374151', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="describe your project..."
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && message.trim() && signal('message', message)}
            style={inputStyle}
          />
          <button
            onClick={() => signal('message', message)}
            disabled={loading || !message.trim()}
            style={btnStyle('#3b82f6')}
          >
            Send
          </button>
        </div>
        {!discoveryApproved && (
          <button
            onClick={() => signal('approve')}
            disabled={loading}
            style={btnStyle('#10b981')}
          >
            Approve Plan
          </button>
        )}
        {feedback && <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{feedback}</span>}
      </div>
    )
  }

  // Review phase: approve PR button
  if (phase === 'review' && !reviewApproved) {
    return (
      <div style={{ marginBottom: '2rem', borderTop: '1px solid #374151', paddingTop: '1rem' }}>
        <button
          onClick={() => signal('approve-pr')}
          disabled={loading}
          style={btnStyle('#10b981')}
        >
          Approve PR
        </button>
        {feedback && <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{feedback}</span>}
      </div>
    )
  }

  return null
}
