import { NavLink } from 'react-router-dom'

export default function Navbar() {
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
        <NavLink to="/settings" className="nav-settings" title="Settings">⚙</NavLink>
      </div>
    </nav>
  )
}
