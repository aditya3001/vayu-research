export default function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-xl)',
      gap: '12px',
      color: 'var(--text-muted)',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>{icon}</div>
      )}
      {title && (
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>{title}</div>
      )}
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', maxWidth: 280, lineHeight: 1.6 }}>{description}</div>
      )}
      {action}
    </div>
  )
}
