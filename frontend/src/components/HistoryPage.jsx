import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getHistory, deleteHistory, downloadHistory } from '../api'

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)

  const load = () => getHistory().then(data => {
    setItems(data)
    if (data.length > 0 && !selected) setSelected(data[0])
  })

  useEffect(() => { load() }, [])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    await deleteHistory(id)
    const remaining = items.filter(i => i.id !== id)
    setItems(remaining)
    if (selected?.id === id) setSelected(remaining[0] || null)
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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left panel — list */}
      <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #1a1a1a' }}>
          <h1 style={{ color: '#fff', fontSize: '16px', fontWeight: 600, margin: 0 }}>History</h1>
          <p style={{ color: '#444', fontSize: '11px', marginTop: '3px' }}>{items.length} result{items.length !== 1 ? 's' : ''}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {items.length === 0 && (
            <p style={{ color: '#444', fontSize: '12px', padding: '16px 8px' }}>No history yet. Run a prompt to get started.</p>
          )}
          {items.map(h => (
            <div
              key={h.id}
              onClick={() => setSelected(h)}
              style={{
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                background: selected?.id === h.id ? '#161410' : 'transparent',
                border: `1px solid ${selected?.id === h.id ? '#2a2010' : 'transparent'}`,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (selected?.id !== h.id) e.currentTarget.style.background = '#111' }}
              onMouseLeave={e => { if (selected?.id !== h.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: selected?.id === h.id ? '#c9a96e' : '#ccc', fontWeight: 500, fontSize: '12px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.prompt_name}
                  </div>
                  <div style={{ color: '#444', fontSize: '10px' }}>{fmt(h.created_at)}{h.model_used ? <span style={{ color: '#333', marginLeft: '4px' }}>· {h.model_used.split('/')[1] || h.model_used}</span> : ''}</div>
                  {inputSummary(h.inputs) && (
                    <div style={{ color: '#333', fontSize: '10px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inputSummary(h.inputs)}
                    </div>
                  )}
                </div>
                <button
                  onClick={e => handleDelete(h.id, e)}
                  style={{ flexShrink: 0, background: 'none', border: 'none', color: '#333', fontSize: '12px', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                  onMouseLeave={e => e.currentTarget.style.color = '#333'}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — result */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{selected.prompt_name}</div>
                <div style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>
                {fmt(selected.created_at)}
                {selected.model_used && <span style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '3px', padding: '1px 6px', fontSize: '10px', color: '#555', fontFamily: 'monospace', marginLeft: '8px' }}>{selected.model_used}</span>}
                {inputSummary(selected.inputs) ? ' · ' + inputSummary(selected.inputs) : ''}
              </div>
              </div>
              <a
                href={downloadHistory(selected.id)}
                download
                style={{ background: '#111', border: '1px solid #222', color: '#666', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', textDecoration: 'none' }}
              >
                ⬇ Download .md
              </a>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.result}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '13px' }}>
            Select a result to view
          </div>
        )}
      </div>
    </div>
  )
}
