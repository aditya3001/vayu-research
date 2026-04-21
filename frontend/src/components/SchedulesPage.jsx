import { useState, useEffect } from 'react'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, getPrompts } from '../api'

const FREQUENCIES = ['daily', 'weekdays', 'weekly']
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [allPrompts, setAllPrompts] = useState([])
  const [form, setForm] = useState({
    prompt_id: '', prompt_name: '', inputs: {},
    frequency: 'daily', day_of_week: 'monday', run_time: '08:00',
    notify_email: false, notify_telegram: false,
  })

  const load = () => getSchedules().then(setSchedules)

  useEffect(() => {
    load()
    getPrompts().then(grouped => setAllPrompts(Object.values(grouped).flat()))
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ prompt_id: '', prompt_name: '', inputs: {}, frequency: 'daily', day_of_week: 'monday', run_time: '08:00', notify_email: false, notify_telegram: false })
    setShowModal(true)
  }

  const openEdit = (s) => { setEditing(s.id); setForm({ ...s }); setShowModal(true) }

  const handlePromptSelect = (promptId) => {
    const p = allPrompts.find(x => x.id === promptId)
    if (!p) return
    const inputs = {}
    ;(p.placeholders || []).forEach(k => { inputs[k] = '' })
    setForm(f => ({ ...f, prompt_id: promptId, prompt_name: p.name, inputs }))
  }

  const handleSave = async () => {
    if (editing) { await updateSchedule(editing, form) } else { await createSchedule(form) }
    setShowModal(false)
    load()
  }

  const active = schedules.filter(s => s.is_active).length
  const paused = schedules.filter(s => !s.is_active).length

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="page-title">Schedules</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>{active} active · {paused} paused</p>
        </div>
        <button className="btn-new" onClick={openNew}>+ New Schedule</button>
      </div>

      {schedules.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No schedules yet.</p>
      )}

      <div className="schedule-list">
        {schedules.map(s => (
          <div key={s.id} className={'schedule-card' + (s.is_active ? '' : ' paused')}>
            <div className="schedule-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                  <span className="schedule-name">{s.prompt_name}</span>
                  <span className={'badge ' + (s.is_active ? 'badge-active' : 'badge-paused')}>
                    {s.is_active ? '● Active' : '⏸ Paused'}
                  </span>
                </div>
                <div className="schedule-timing">
                  {s.frequency === 'weekly'
                    ? `Every ${s.day_of_week}`
                    : s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)
                  } at {s.run_time}
                </div>
                <div className="schedule-badges">
                  {s.notify_email && <span className="badge badge-email">✉ Email</span>}
                  {s.notify_telegram && <span className="badge badge-telegram">✈ Telegram</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)' }}>
                <div className="schedule-actions">
                  <button className="btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-sm" onClick={async () => { await toggleSchedule(s.id); load() }}>
                    {s.is_active ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  <button className="btn-sm danger" onClick={async () => { await deleteSchedule(s.id); load() }}>
                    Delete
                  </button>
                </div>
                <div className="schedule-last-run">
                  {s.last_run_at
                    ? `Last: ${s.last_run_at.slice(0, 16).replace('T', ' ')}`
                    : 'Never run'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Schedule' : 'New Schedule'}</h2>

            <label className="modal-label">Prompt</label>
            <select
              className="modal-select"
              value={form.prompt_id}
              onChange={e => handlePromptSelect(e.target.value)}
              disabled={!!editing}
            >
              <option value="">— select a prompt —</option>
              {allPrompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {form.prompt_id && Object.keys(form.inputs).map(key => (
              <div key={key}>
                <label className="modal-label">{key}</label>
                <input
                  className="modal-input"
                  value={form.inputs[key] || ''}
                  onChange={e => setForm(f => ({ ...f, inputs: { ...f.inputs, [key]: e.target.value } }))}
                  placeholder={`Enter ${key.toLowerCase()}`}
                />
              </div>
            ))}

            <label className="modal-label">Frequency</label>
            <select className="modal-select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>

            {form.frequency === 'weekly' && (
              <>
                <label className="modal-label">Day of Week</label>
                <select className="modal-select" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </>
            )}

            <label className="modal-label">Run Time</label>
            <input
              className="modal-input"
              type="time"
              value={form.run_time}
              onChange={e => setForm(f => ({ ...f, run_time: e.target.value }))}
            />

            <div className="modal-checks">
              <label className="modal-check-label">
                <input
                  type="checkbox"
                  checked={form.notify_email}
                  onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))}
                />
                Email
              </label>
              <label className="modal-check-label">
                <input
                  type="checkbox"
                  checked={form.notify_telegram}
                  onChange={e => setForm(f => ({ ...f, notify_telegram: e.target.checked }))}
                />
                Telegram
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
