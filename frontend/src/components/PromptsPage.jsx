import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrompts } from '../api'

const CATEGORIES = [
  { id: 'all',                    label: 'All',            icon: '✦' },
  { id: 'market-intelligence',    label: 'Market Intel',   icon: '📊' },
  { id: 'fundamental-research',   label: 'Fundamental',    icon: '🔍' },
  { id: 'quick-tools',            label: 'Quick Tools',    icon: '⚡' },
  { id: 'advanced',               label: 'Advanced',       icon: '🚀' },
  { id: 'visual-design',          label: 'Visual',         icon: '🎨' },
]

const CAT_COLORS = {
  'market-intelligence':  '#1a3a2a',
  'fundamental-research': '#1a2a3a',
  'quick-tools':          '#2a1a3a',
  'advanced':             '#3a2a10',
  'visual-design':        '#2a1a20',
}
const CAT_TEXT = {
  'market-intelligence':  '#4caf7a',
  'fundamental-research': '#4a9ecf',
  'quick-tools':          '#a07acf',
  'advanced':             '#c9a96e',
  'visual-design':        '#cf7a9e',
}

export default function PromptsPage() {
  const navigate = useNavigate()
  const [grouped, setGrouped] = useState({})
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPrompts().then(setGrouped).catch(console.error)
  }, [])

  const allPrompts = Object.entries(grouped).flatMap(([catId, prompts]) =>
    prompts.map(p => ({ ...p, categoryId: catId }))
  )

  const filtered = allPrompts.filter(p => {
    const matchCat = activeTab === 'all' || p.categoryId === activeTab
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const catLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || id

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Research Library</h1>
        <p style={{ color: '#444', fontSize: '13px', margin: 0 }}>{allPrompts.length} prompts · click any to run</p>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              style={{
                background: activeTab === cat.id ? '#c9a96e' : '#111',
                color: activeTab === cat.id ? '#000' : '#666',
                border: `1px solid ${activeTab === cat.id ? '#c9a96e' : '#222'}`,
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: activeTab === cat.id ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts..."
          style={{
            marginLeft: 'auto',
            background: '#0d0d0d',
            border: '1px solid #222',
            borderRadius: '4px',
            padding: '6px 12px',
            color: '#ccc',
            fontSize: '12px',
            outline: 'none',
            width: '180px',
          }}
          onFocus={e => e.target.style.borderColor = '#c9a96e'}
          onBlur={e => e.target.style.borderColor = '#222'}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p style={{ color: '#444', fontSize: '13px' }}>No prompts found.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '14px',
        }}>
          {filtered.map(p => (
            <PromptCard key={p.id} prompt={p} catLabel={catLabel(p.categoryId)} onClick={() => navigate(`/prompt/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PromptCard({ prompt, catLabel, onClick }) {
  const [hovered, setHovered] = useState(false)
  const catId = prompt.categoryId
  const bgAccent = CAT_COLORS[catId] || '#1a1a1a'
  const textAccent = CAT_TEXT[catId] || '#888'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#131313' : '#0f0f0f',
        border: `1px solid ${hovered ? '#2a2a2a' : '#1a1a1a'}`,
        borderRadius: '8px',
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {/* Category badge */}
      <span style={{
        display: 'inline-block',
        alignSelf: 'flex-start',
        background: bgAccent,
        color: textAccent,
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '3px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
        {catLabel}
      </span>

      {/* Name */}
      <div style={{
        color: hovered ? '#fff' : '#e0e0e0',
        fontWeight: 600,
        fontSize: '14px',
        lineHeight: '1.4',
        transition: 'color 0.15s',
      }}>
        {prompt.name}
      </div>

      {/* Description */}
      {prompt.description && (
        <div style={{
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.6',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {prompt.description}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        {prompt.placeholders?.length > 0 ? (
          <span style={{ color: '#333', fontSize: '10px' }}>
            {prompt.placeholders.length} input{prompt.placeholders.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{ color: '#333', fontSize: '10px' }}>no inputs required</span>
        )}
        <span style={{
          color: hovered ? '#c9a96e' : '#333',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'color 0.15s',
        }}>
          Run →
        </span>
      </div>
    </div>
  )
}
