import { useState, useEffect, useRef } from 'react'

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

function Stat({ value, label, color = 'var(--accent)' }) {
  const display = useCountUp(value)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 5,
      paddingRight: 20,
      marginRight: 20,
      borderRight: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 20,
        fontWeight: 800,
        fontFamily: 'var(--font-display)',
        color,
        lineHeight: 1,
        minWidth: '1.5ch',
        textAlign: 'right',
      }}>
        {display}
      </span>
      <span style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        fontWeight: 600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function StatsBar({ historyCount = 0, activeSchedules = 0, promptCount = 0, loading = true }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '10px 0',
      marginBottom: 'var(--space-md)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      animation: loading ? 'none' : 'vr-fade-in 0.4s ease',
      opacity: loading ? 0.4 : 1,
      transition: 'opacity 0.3s',
    }}>
      <Stat value={historyCount}     label="total runs"        color="var(--accent)" />
      <Stat value={activeSchedules}  label="active schedules"  color="var(--cat-market-text)" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontSize: 20,
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          color: 'var(--cat-quick-text)',
          lineHeight: 1,
        }}>
          {promptCount}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}>
          prompts
        </span>
      </div>
    </div>
  )
}
