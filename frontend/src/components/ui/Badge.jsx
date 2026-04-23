/* ── Category icons ──────────────────────────────────────────────── */
const IconTrendingUp = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <polyline points="1,11 5,6 9,9 15,3" />
    <polyline points="11,3 15,3 15,7" />
  </svg>
)

const IconSearch = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <circle cx="6.5" cy="6.5" r="4.5" />
    <path d="M11.5 11.5l3 3" />
  </svg>
)

const IconZap = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <polygon points="9,1 2,9 8,9 7,15 14,7 8,7" />
  </svg>
)

const IconStar = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <polygon points="8,1.5 10,6 15,6.5 11.5,10 12.5,15 8,12.5 3.5,15 4.5,10 1,6.5 6,6" />
  </svg>
)

const IconBrush = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <path d="M2 14c2-2 3-4 5-4s3 2 3 3-1 2-2 2-3-1-6 0" />
    <path d="M6 10L13 2" />
    <path d="M12 2l2 2" />
  </svg>
)

const IconGrid = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
  </svg>
)

/* ── Category config ─────────────────────────────────────────────── */
export const CAT_CONFIG = {
  'market-intelligence':  { cls: 'cat-badge market-intelligence', label: 'Market Intel',  Icon: IconTrendingUp },
  'fundamental-research': { cls: 'cat-badge fundamental-research', label: 'Fundamental',   Icon: IconSearch },
  'quick-tools':          { cls: 'cat-badge quick-tools',          label: 'Quick Tools',   Icon: IconZap },
  'advanced':             { cls: 'cat-badge advanced',             label: 'Advanced',      Icon: IconStar },
  'visual-design':        { cls: 'cat-badge visual-design',        label: 'Visual',        Icon: IconBrush },
  'all':                  { cls: 'cat-badge',                      label: 'All',           Icon: IconGrid },
}

export function CatBadge({ category }) {
  const cfg = CAT_CONFIG[category]
  if (!cfg) return <span className="cat-badge">{category?.replace(/-/g, ' ')}</span>
  const { cls, label, Icon } = cfg
  return (
    <span className={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon />
      {label}
    </span>
  )
}

export function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? 'badge-active' : 'badge-paused'}`}>
      {active ? '● Active' : '⏸ Paused'}
    </span>
  )
}

export function NotifBadge({ type }) {
  if (type === 'email')    return <span className="badge badge-email">✉ Email</span>
  if (type === 'telegram') return <span className="badge badge-telegram">✈ Telegram</span>
  return null
}
