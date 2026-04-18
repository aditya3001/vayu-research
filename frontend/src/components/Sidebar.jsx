import { NavLink } from 'react-router-dom'

const linkStyle = (active) => ({
  display: 'block',
  padding: '6px 10px',
  marginBottom: '2px',
  borderRadius: '4px',
  color: active ? '#fff' : '#888',
  background: active ? '#1e1e1e' : 'transparent',
  borderLeft: active ? '2px solid #c9a96e' : '2px solid transparent',
  textDecoration: 'none',
  fontSize: '13px',
  cursor: 'pointer',
})

export default function Sidebar({ categories }) {
  return (
    <div style={{ width: '200px', background: '#111', borderRight: '1px solid #222', padding: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 700, color: '#c9a96e', marginBottom: '20px', fontSize: '14px', letterSpacing: '1px' }}>
        VAYU RESEARCH
      </div>

      <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        Prompts
      </div>

      {categories.map(cat => (
        <NavLink
          key={cat.id}
          to={`/category/${cat.id}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          {cat.icon} {cat.label}
        </NavLink>
      ))}

      <div style={{ borderTop: '1px solid #222', marginTop: 'auto', paddingTop: '16px' }}>
        <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Other
        </div>
        <NavLink to="/history" style={({ isActive }) => linkStyle(isActive)}>📁 History</NavLink>
        <NavLink to="/schedules" style={({ isActive }) => linkStyle(isActive)}>🕐 Schedules</NavLink>
        <NavLink to="/settings" style={({ isActive }) => linkStyle(isActive)}>⚙️ Settings</NavLink>
      </div>
    </div>
  )
}
