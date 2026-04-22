import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

export default function Navbar() {
  const [theme, setTheme] = useState(() => localStorage.getItem('vayu-theme') || 'dark')

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('vayu-theme', theme)
  }, [theme])

  return (
    <nav className="nav">
      <NavLink to="/" className="nav-logo" end>VAYU</NavLink>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Library
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          History
        </NavLink>
        <NavLink to="/schedules" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Schedules
        </NavLink>
      </div>
      <div className="nav-right">
        <button
          className="nav-theme-toggle"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <NavLink to="/settings" className="nav-settings" title="Settings">⚙</NavLink>
      </div>
    </nav>
  )
}
