import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

/* ── SVG Icons ───────────────────────────────────────────────────── */
const IconGrid = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" />
  </svg>
)

const IconClock = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6.25v3.75l2.5 2.5" />
  </svg>
)

const IconCalendar = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <rect x="2.5" y="3.75" width="15" height="13.75" rx="2" />
    <path d="M2.5 8.75h15M6.25 2.5v2.5M13.75 2.5v2.5" />
  </svg>
)

const IconSettings = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <circle cx="10" cy="10" r="2.5" />
    <path d="M10 2.5v1.25M10 16.25v1.25M2.5 10h1.25M16.25 10h1.25M4.697 4.697l.884.884M14.42 14.42l.883.883M4.697 15.303l.884-.884M14.42 5.58l.883-.883" />
  </svg>
)

const IconSun = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.06 1.06M14.84 14.84l1.06 1.06M4.1 15.9l1.06-1.06M14.84 5.16l1.06-1.06" />
  </svg>
)

const IconMoon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="M17.5 10.9A7.5 7.5 0 0 1 9.1 2.5a7.5 7.5 0 1 0 8.4 8.4z" />
  </svg>
)

const IconChevronLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M12.5 15L7.5 10l5-5" />
  </svg>
)

const IconChevronRight = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M7.5 5l5 5-5 5" />
  </svg>
)

const IconLogOut = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="M7.5 10h8.75M13.75 7.5L16.25 10l-2.5 2.5" />
    <path d="M12.5 3.75H4.375A1.875 1.875 0 0 0 2.5 5.625v8.75a1.875 1.875 0 0 0 1.875 1.875H12.5" />
  </svg>
)

/* ── Nav items ───────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { to: '/',          label: 'Library',   Icon: IconGrid,     end: true },
  { to: '/history',   label: 'History',   Icon: IconClock },
  { to: '/schedules', label: 'Schedules', Icon: IconCalendar },
]

/* ── Sidebar ─────────────────────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('vayu-sidebar') === 'collapsed'
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('vayu-theme') || 'dark'
  )
  const { user, logoutFn } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logoutFn()
    navigate('/login')
  }

  useEffect(() => {
    localStorage.setItem('vayu-sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('vayu-theme', theme)
  }, [theme])

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">V</span>
        <span className="sidebar-logo-text">AYU</span>
      </div>

      {/* Main nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <span className="sidebar-icon"><Icon /></span>
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sidebar-icon"><IconSettings /></span>
          <span className="sidebar-label">Settings</span>
        </NavLink>

        <button
          className="sidebar-link sidebar-btn"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="sidebar-icon">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </span>
          <span className="sidebar-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {user && (
          <>
            <div className="sidebar-user" title={user.email}>
              <span className="sidebar-user-avatar">
                {user.email?.[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="sidebar-label sidebar-user-email">{user.email}</span>
            </div>
            <button
              className="sidebar-link sidebar-btn"
              onClick={handleLogout}
              title={collapsed ? 'Sign out' : undefined}
            >
              <span className="sidebar-icon"><IconLogOut /></span>
              <span className="sidebar-label">Sign out</span>
            </button>
          </>
        )}

        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>
    </aside>
  )
}
