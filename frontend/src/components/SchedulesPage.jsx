import { useState, useEffect } from 'react'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, getPrompts } from '../api'

const FREQUENCIES = ['daily', 'weekdays', 'weekly']
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MODELS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [allPrompts, setAllPrompts] = useState([])
  const [form, setForm] = useState({ prompt_id: '', prompt_name: '', inputs: {}, frequency: 'daily', day_of_week: 'monday', run_time: '08:00', provider: 'anthropic', model_name: 'claude-opus-4-6', notify_email: false, notify_telegram: false })

  const load = () => getSchedules().then(setSchedules)
  useEffect(() => {
    load()
    getPrompts().then(grouped => {
      const flat = Object.values(grouped).flat()
      setAllPrompts(flat)
    })
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ prompt_id: '', prompt_name: '', inputs: {}, frequency: 'daily', day_of_week: 'monday', run_time: '08:00', provider: 'anthropic', model_name: 'claude-opus-4-6', notify_email: false, notify_telegram: false })
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditing(s.id)
    setForm({ ...s })
    setShowModal(true)
  }

  const handlePromptSelect = (promptId) => {
    const p = allPrompts.find(x => x.id === promptId)
    if (!p) return
    const inputs = {}
    ;(p.placeholders || []).forEach(k => { inputs[k] = '' })
    setForm(f => ({ ...f, prompt_id: promptId, prompt_name: p.name, inputs }))
  }

  const handleSave = async () => {
    if (editing) {
      await updateSchedule(editing, form)
    } else {
      await createSchedule(form)
    }
    setShowModal(false)
    load()
  }

  const active = schedules.filter(s => s.is_active).length
  const paused = schedules.filter(s => !s.is_active).length

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>Schedules</h1>
          <p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>{active} active · {paused} paused</p>
        </div>
        <button onClick={openNew} style={{ background: '#c9a96e', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          + New Schedule
        </button>
      </div>

      {schedules.length === 0 && <p style={{ color: '#555' }}>No schedules yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {schedules.map(s => (
          <div key={s.id} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '14px 16px', opacity: s.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{s.prompt_name}</span>
                  <span style={{ background: s.is_active ? '#1a3a1a' : '#2a2a1a', color: s.is_active ? '#4caf50' : '#ffa726', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>
                    {s.is_active ? '● Active' : '⏸ Paused'}
                  </span>
                </div>
                <div style={{ color: '#555', fontSize: '11px', marginBottom: '6px' }}>
                  {s.frequency === 'weekly' ? `Every ${s.day_of_week}` : s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} at {s.run_time}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {s.notify_email && <span style={{ background: '#1a1a2e', color: '#7986cb', padding: '2px 8px', borderRadius: '3px', fontSize: '10px' }}>✉ Email</span>}
                  {s.notify_telegram && <span style={{ background: '#1a2a1a', color: '#66bb6a', padding: '2px 8px', borderRadius: '3px', fontSize: '10px' }}>✈ Telegram</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEdit(s)} style={smallBtn}>Edit</button>
                  <button onClick={async () => { await toggleSchedule(s.id); load() }} style={smallBtn}>
                    {s.is_active ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  <button onClick={async () => { await deleteSchedule(s.id); load() }} style={{ ...smallBtn, color: '#ff6b6b' }}>Delete</button>
                </div>
                <div style={{ color: '#444', fontSize: '10px' }}>
                  {s.last_run_at ? `Last: ${s.last_run_at.slice(0, 16).replace('T', ' ')}` : 'Never run'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '24px', width: '480px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ color: '#fff', margin: '0 0 16px', fontSize: '16px' }}>{editing ? 'Edit Schedule' : 'New Schedule'}</h2>

            <label style={labelStyle}>Prompt</label>
            <select
              value={form.prompt_id}
              onChange={e => handlePromptSelect(e.target.value)}
              style={inputStyle}
              disabled={!!editing}
            >
              <option value="">— select a prompt —</option>
              {allPrompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {form.prompt_id && Object.keys(form.inputs).map(key => (
              <div key={key}>
                <label style={labelStyle}>{key}</label>
                <input
                  value={form.inputs[key] || ''}
                  onChange={e => setForm(f => ({ ...f, inputs: { ...f.inputs, [key]: e.target.value } }))}
                  style={inputStyle}
                  placeholder={`Enter ${key.toLowerCase()}`}
                />
              </div>
            ))}

            <label style={labelStyle}>Provider</label>
            <select
              value={form.provider}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value, model_name: MODELS[e.target.value][0] }))}
              style={inputStyle}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>

            <label style={labelStyle}>Model</label>
            <select
              value={form.model_name || MODELS[form.provider || 'anthropic'][0]}
              onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
              style={inputStyle}
            >
              {(MODELS[form.provider || 'anthropic']).map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={labelStyle}>Frequency</label>
            <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} style={inputStyle}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>

            {form.frequency === 'weekly' && (
              <>
                <label style={labelStyle}>Day of Week</label>
                <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} style={inputStyle}>
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </>
            )}

            <label style={labelStyle}>Run Time</label>
            <input type="time" value={form.run_time} onChange={e => setForm(f => ({ ...f, run_time: e.target.value }))} style={inputStyle} />

            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', marginBottom: '16px' }}>
              <label style={{ color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.notify_email} onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))} style={{ marginRight: '6px' }} />
                Email
              </label>
              <label style={{ color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.notify_telegram} onChange={e => setForm(f => ({ ...f, notify_telegram: e.target.checked }))} style={{ marginRight: '6px' }} />
                Telegram
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={smallBtn}>Cancel</button>
              <button onClick={handleSave} style={{ background: '#c9a96e', color: '#000', border: 'none', padding: '7px 20px', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const smallBtn = { background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '5px 10px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }
const labelStyle = { display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px', marginTop: '10px' }
const inputStyle = { width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px', color: '#fff', fontSize: '13px', outline: 'none' }
