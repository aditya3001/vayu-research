import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getPrompts } from '../api'

export default function PromptList({ categories }) {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [grouped, setGrouped] = useState({})

  useEffect(() => {
    getPrompts().then(setGrouped).catch(console.error)
  }, [])

  const cat = categories.find(c => c.id === categoryId)
  const prompts = grouped[categoryId] || []

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>
          {cat?.icon} {cat?.label}
        </h1>
        <p style={{ color: '#555', fontSize: '13px', marginTop: '4px' }}>
          {prompts.length} prompts available
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {prompts.map(p => (
          <div
            key={p.id}
            onClick={() => navigate(`/prompt/${p.id}`)}
            style={{
              background: '#111',
              border: '1px solid #1e1e1e',
              borderLeft: '3px solid #c9a96e',
              borderRadius: '6px',
              padding: '14px 16px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderLeftColor = '#e8c47e'}
            onMouseLeave={e => e.currentTarget.style.borderLeftColor = '#c9a96e'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{p.name}</span>
              <span style={{ background: '#1e1e1e', color: '#666', fontSize: '10px', padding: '2px 8px', borderRadius: '10px' }}>
                {p.best_used_in}
              </span>
            </div>
            <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>{p.description}</p>
          </div>
        ))}
        {prompts.length === 0 && (
          <p style={{ color: '#444' }}>Loading prompts...</p>
        )}
      </div>
    </div>
  )
}
