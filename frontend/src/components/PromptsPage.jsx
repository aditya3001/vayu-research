import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrompts } from '../api'

const CATEGORIES = [
  { id: 'all',                  label: 'All' },
  { id: 'market-intelligence',  label: 'Market Intel' },
  { id: 'fundamental-research', label: 'Fundamental' },
  { id: 'quick-tools',          label: 'Quick Tools' },
  { id: 'advanced',             label: 'Advanced' },
  { id: 'visual-design',        label: 'Visual' },
]

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
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="page">
      <h1 className="page-title">Research Library</h1>
      <p className="page-sub">{allPrompts.length} prompts · click any to run</p>

      <div className="filter-row">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={'filter-chip' + (activeTab === cat.id ? ' active' : '')}
            onClick={() => setActiveTab(cat.id)}
          >
            {cat.label}
          </button>
        ))}
        <input
          className="filter-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts..."
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No prompts found.</p>
      ) : (
        <div className="card-grid">
          {filtered.map(p => (
            <PromptCard
              key={p.id}
              prompt={p}
              onClick={() => navigate(`/prompt/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PromptCard({ prompt, onClick }) {
  return (
    <div className="prompt-card" onClick={onClick}>
      <span className={`cat-badge ${prompt.categoryId}`}>
        {prompt.categoryId.replace(/-/g, ' ')}
      </span>
      <div className="card-name">{prompt.name}</div>
      {prompt.description && (
        <div className="card-desc">{prompt.description}</div>
      )}
      <div className="card-footer">
        <span className="card-meta">
          {prompt.placeholders?.length > 0
            ? `${prompt.placeholders.length} input${prompt.placeholders.length !== 1 ? 's' : ''}`
            : 'no inputs required'}
        </span>
        <span className="card-run">Run →</span>
      </div>
    </div>
  )
}
