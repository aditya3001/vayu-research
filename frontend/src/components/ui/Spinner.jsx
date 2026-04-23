export default function Spinner({ size = 16, className = '' }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `1.5px solid var(--border-strong)`,
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'vr-spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}
