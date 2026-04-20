import { NavLink } from 'react-router-dom'

const link = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 10px',
  marginBottom: '2px',
  borderRadius: '5px',
  color: active ? '#fff' : '#555',
  background: active ? '#1a1a1a' : 'transparent',
  borderLeft: `2px solid ${active ? '#c9a96e' : 'transparent'}`,
  textDecoration: 'none',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.15s',
})

export default function Sidebar() {
  return (
    <div style={{
      width: '180px',
      background: '#0a0a0a',
      borderRight: '1px solid #1a1a1a',
      padding: '20px 12px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '28px', padding: '0 4px' }}>
        <div style={{ color: '#c9a96e', fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px' }}>VAYU</div>
        <div style={{ color: '#333', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', marginTop: '1px' }}>RESEARCH</div>
      </div>

      {/* Primary */}
      <div style={{ flex: 1 }}>
        <NavLink to="/" end style={({ isActive }) => link(isActive)}>
          <span>✦</span> Library
        </NavLink>
        <NavLink to="/history" style={({ isActive }) => link(isActive)}>
          <span>◷</span> History
        </NavLink>
        <NavLink to="/schedules" style={({ isActive }) => link(isActive)}>
          <span>⏱</span> Schedules
        </NavLink>
      </div>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '12px' }}>
        <NavLink to="/settings" style={({ isActive }) => link(isActive)}>
          <span>⚙</span> Settings
        </NavLink>
      </div>
    </div>
  )
}
