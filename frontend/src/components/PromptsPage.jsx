import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrompts, getHistory, getSchedules } from '../api'
import { CatBadge, CAT_CONFIG } from './ui/Badge'
import EmptyState from './ui/EmptyState'
import StatsBar from './ui/StatsBar'

const CATEGORIES = [
  { id: 'all',                  label: 'All' },
  { id: 'market-intelligence',  label: 'Market Intel' },
  { id: 'fundamental-research', label: 'Fundamental' },
  { id: 'quick-tools',          label: 'Quick Tools' },
  { id: 'advanced',             label: 'Advanced' },
  { id: 'visual-design',        label: 'Visual' },
]

const CAT_ORDER = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id)

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
    style={{ width: 12, height: 12, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}>
    <circle cx="6.5" cy="6.5" r="4" />
    <path d="M11 11l2.5 2.5" />
  </svg>
)

export default function PromptsPage() {
  const navigate = useNavigate()
  const [grouped, setGrouped]         = useState({})
  const [activeTab, setActiveTab]     = useState('all')
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [historyCount, setHistoryCount]       = useState(0)
  const [activeSchedules, setActiveSchedules] = useState(0)
  const [statsLoading, setStatsLoading]       = useState(true)

  useEffect(() => {
    getPrompts()
      .then(setGrouped)
      .catch(console.error)
      .finally(() => setLoading(false))

    // Fetch stats in parallel — fire and forget, no blocking
    Promise.all([getHistory(), getSchedules()])
      .then(([history, schedules]) => {
        setHistoryCount(history.length)
        setActiveSchedules(schedules.filter(s => s.is_active).length)
      })
      .catch(() => {}) // stats are non-critical
      .finally(() => setStatsLoading(false))
  }, [])

  const allPrompts = Object.entries(grouped).flatMap(([catId, prompts]) =>
    prompts.map(p => ({ ...p, categoryId: catId }))
  )

  const filtered = allPrompts.filter(p => {
    const matchCat    = activeTab === 'all' || p.categoryId === activeTab
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const groupedFiltered = CAT_ORDER
    .map(catId => ({
      catId,
      label: CATEGORIES.find(c => c.id === catId)?.label || catId,
      prompts: filtered.filter(p => p.categoryId === catId),
    }))
    .filter(g => g.prompts.length > 0)

  return (
    <div className="page">
      {/* Page header */}
      <h1 className="page-title">Research Library</h1>
      <p className="page-sub">
        {loading ? 'Loading prompts…' : `${allPrompts.length} prompts · click any to run`}
      </p>

      {/* Stats bar */}
      <StatsBar
        historyCount={historyCount}
        activeSchedules={activeSchedules}
        promptCount={allPrompts.length}
        loading={statsLoading}
      />

      {/* Filter row */}
      <div className="filter-row">
        {CATEGORIES.map(cat => {
          const cfg = CAT_CONFIG[cat.id]
          const Icon = cfg?.Icon
          return (
            <button
              key={cat.id}
              className={`filter-chip${activeTab === cat.id ? ' active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {Icon && <Icon />}
              {cat.label}
            </button>
          )
        })}
        <div style={{ position: 'relative', marginLeft: 'auto', marginBottom: 6 }}>
          <SearchIcon />
          <input
            className="filter-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{ paddingLeft: 26 }}
          />
        </div>
      </div>

      {/* Results */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          title="No prompts found"
          description={search ? `No results for "${search}"` : 'This category is empty.'}
        />
      )}

      {activeTab === 'all' ? (
        <div className="library-sections">
          {groupedFiltered.map(({ catId, prompts }) => (
            <div key={catId} className="library-section">
              <div className="library-section-header">
                <CatBadge category={catId} />
                <span className="library-section-count">{prompts.length}</span>
              </div>
              <div className="card-grid">
                {prompts.map(p => (
                  <PromptCard key={p.id} prompt={p} onClick={() => navigate(`/prompt/${p.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map(p => (
            <PromptCard key={p.id} prompt={p} onClick={() => navigate(`/prompt/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PromptCard({ prompt, onClick }) {
  return (
    <div className="prompt-card" onClick={onClick}>
      <CatBadge category={prompt.categoryId} />
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
