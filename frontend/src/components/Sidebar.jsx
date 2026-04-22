import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',          label: 'Library',   icon: '⊞', end: true },
  { to: '/history',   label: 'History',   icon: '◷' },
  { to: '/schedules', label: 'Schedules', icon: '⌛' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('vayu-sidebar') === 'collapsed'
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('vayu-theme') || 'dark'
  )

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
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">V</span>
        <span className="sidebar-logo-text">AYU</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sidebar-icon">⚙</span>
          <span className="sidebar-label">Settings</span>
        </NavLink>

        <button
          className="sidebar-link sidebar-btn"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          <span className="sidebar-icon">{theme === 'dark' ? '☀' : '☾'}</span>
          <span className="sidebar-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span>{collapsed ? '›' : '‹'}</span>
        </button>
      </div>
    </aside>
  )
}
