import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { getHistory, deleteHistory, downloadHistory } from '../api'

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)

  const load = () => getHistory().then(setItems)
  useEffect(() => { load() }, [])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    await deleteHistory(id)
    load()
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ color: '#fff', fontSize: '20px', marginBottom: '20px' }}>History</h1>

      {items.length === 0 && <p style={{ color: '#555' }}>No history yet. Run a prompt to get started.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(h => (
          <div
            key={h.id}
            onClick={() => setSelected(h)}
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{h.prompt_name}</div>
              <div style={{ color: '#555', fontSize: '11px' }}>
                {h.created_at?.slice(0, 16).replace('T', ' ')} · {h.source}
                {' · '}
                {Object.entries(h.inputs).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <a href={downloadHistory(h.id)} download onClick={e => e.stopPropagation()} style={smallBtn}>⬇</a>
              <button onClick={e => handleDelete(h.id, e)} style={{ ...smallBtn, color: '#ff6b6b' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '24px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '16px' }}>{selected.prompt_name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.7' }}>
              <ReactMarkdown>{selected.result}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const smallBtn = {
  background: '#1a1a1a', border: '1px solid #333', color: '#888',
  padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer', textDecoration: 'none'
}
