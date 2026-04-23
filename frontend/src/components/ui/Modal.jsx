import { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = 460 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h2 className="modal-title" style={{ marginBottom: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text-faint)',
                cursor: 'pointer', padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                fontSize: '16px', lineHeight: 1, transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
