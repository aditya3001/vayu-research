import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getHistory, deleteHistory, downloadHistory } from '../api'
import ConfirmDialog from './ConfirmDialog'

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const load = () => getHistory().then(data => {
    setItems(data)
    if (data.length > 0 && !selected) setSelected(data[0])
  })

  useEffect(() => { load() }, [])

  const handleDelete = (id, e) => {
    e.stopPropagation()
    setConfirmId(id)
  }

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

      {/* Left panel — list */}
      <div className="history-list">
        <div className="history-list-header">
          <h1 className="page-title" style={{ fontSize: '16px' }}>History</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {items.length} result{items.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="history-items">
          {items.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: 'var(--space-md) var(--space-sm)' }}>
              No history yet. Run a prompt to get started.
            </p>
          )}
          {items.map(h => (
            <div
              key={h.id}
              className={'history-item' + (selected?.id === h.id ? ' selected' : '')}
              onClick={() => setSelected(h)}
            >
              <div style={{ minWidth: 0 }}>
                <div className="history-item-name">{h.prompt_name}</div>
                <div className="history-item-meta">
                  {fmt(h.created_at)}
                  {h.model_used && (
                    <span style={{ marginLeft: 'var(--space-xs)', color: 'var(--text-faint)' }}>
                      · {h.model_used.split('/')[1] || h.model_used}
                    </span>
                  )}
                </div>
                {inputSummary(h.inputs) && (
                  <div className="history-item-inputs">{inputSummary(h.inputs)}</div>
                )}
              </div>
              <button className="history-delete" onClick={e => handleDelete(h.id, e)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — viewer */}
      <div className="history-viewer">
        {selected ? (
          <>
            <div className="history-viewer-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                  {selected.prompt_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {fmt(selected.created_at)}
                  {selected.model_used && (
                    <span className="model-badge">{selected.model_used}</span>
                  )}
                  {inputSummary(selected.inputs) && (
                    <span> · {inputSummary(selected.inputs)}</span>
                  )}
                </div>
              </div>
              <a className="download-btn" href={downloadHistory(selected.id)} download>
                ⬇ Download .md
              </a>
            </div>
            <div className="history-viewer-body">
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.result}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="history-empty">Select a result to view</div>
        )}
      </div>
    </div>
  )
}
