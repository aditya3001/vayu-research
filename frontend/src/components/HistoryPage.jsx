import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getHistory, deleteHistory, downloadHistory } from '../api'
import ConfirmDialog from './ConfirmDialog'
import EmptyState from './ui/EmptyState'

export default function HistoryPage() {
  const [items, setItems]       = useState([])
  const [selected, setSelected] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [listOpen, setListOpen] = useState(true)

  const load = () => getHistory().then(data => {
    setItems(data)
    if (data.length > 0 && !selected) setSelected(data[0])
  })

  useEffect(() => { load() }, [])

  const handleDelete = (id, e) => { e.stopPropagation(); setConfirmId(id) }

  const confirmDelete = async () => {
    await deleteHistory(confirmId)
    const remaining = items.filter(i => i.id !== confirmId)
    setItems(remaining)
    if (selected?.id === confirmId) setSelected(remaining[0] || null)
    setConfirmId(null)
  }

  const fmt = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const inputSummary = (inputs) => {
    const entries = Object.entries(inputs || {}).filter(([, v]) => v)
    if (!entries.length) return null
    return entries.map(([k, v]) => `${k}: ${v}`).join(' · ')
  }

  return (
    <div className="history">
      {confirmId && (
        <ConfirmDialog
          message="Delete this history entry?"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* ── Left: list panel ─────────────────────────────────────────── */}
      <div className={`history-list${listOpen ? '' : ' collapsed'}`}>
        <div className="history-list-header">
          <div>
            <h1 className="page-title" style={{ fontSize: 16 }}>History</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {items.length} result{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="history-list-toggle" onClick={() => setListOpen(false)} title="Collapse list">‹</button>
        </div>

        <div className="history-items">
          {items.length === 0 && (
            <EmptyState
              title="No history yet"
              description="Run a prompt to see results here."
            />
          )}
          {items.map(h => (
            <div
              key={h.id}
              className={`history-item${selected?.id === h.id ? ' selected' : ''}`}
              onClick={() => {
                setSelected(h)
                if (window.innerWidth < 768) setListOpen(false)
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="history-item-name">{h.prompt_name}</div>
                <div className="history-item-meta">
                  {fmt(h.created_at)}
                  {h.model_used && (
                    <span style={{ marginLeft: 4, color: 'var(--text-faint)' }}>
                      · {h.model_used.split('/')[1] || h.model_used}
                    </span>
                  )}
                </div>
                {inputSummary(h.inputs) && (
                  <div className="history-item-inputs">{inputSummary(h.inputs)}</div>
                )}
              </div>
              <button className="history-delete" onClick={e => handleDelete(h.id, e)} title="Delete">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: viewer panel ──────────────────────────────────────── */}
      <div className="history-viewer">
        {selected ? (
          <>
            <div className="history-viewer-header">
              {!listOpen && (
                <button className="history-list-expand" onClick={() => setListOpen(true)} title="Show list">≡</button>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {selected.prompt_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {fmt(selected.created_at)}
                  {selected.model_used && (
                    <span className="model-badge">{selected.model_used}</span>
                  )}
                  {inputSummary(selected.inputs) && (
                    <span>· {inputSummary(selected.inputs)}</span>
                  )}
                </div>
              </div>
              <button className="download-btn" onClick={() => downloadHistory(selected.id)}>
                ⬇ Download .md
              </button>
            </div>
            <div className="history-viewer-body">
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.result}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="history-empty">
            {!listOpen && (
              <button className="history-list-expand" onClick={() => setListOpen(true)} style={{ marginBottom: 8 }}>≡</button>
            )}
            <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              Select a result to view
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
