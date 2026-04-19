import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api'

const Section = ({ title, children }) => (
  <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
    <h3 style={{ color: '#c9a96e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '18px', marginTop: 0 }}>{title}</h3>
    {children}
  </div>
)

const Field = ({ label, value, onChange, placeholder, type = 'text', hint }) => (
  <div style={{ marginBottom: hint ? '12px' : '14px' }}>
    <label style={{ display: 'block', color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #222', borderRadius: '4px', padding: '9px 12px', color: '#e0e0e0', fontSize: '13px', outline: 'none', transition: 'border-color 0.15s' }}
      onFocus={e => e.target.style.borderColor = '#c9a96e'}
      onBlur={e => e.target.style.borderColor = '#222'}
    />
    {hint && <p style={{ color: '#444', fontSize: '11px', margin: '6px 0 0', lineHeight: '1.5' }}>{hint}</p>}
  </div>
)

const StatusDot = ({ active, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: active ? '#4caf50' : '#555' }}>
    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? '#4caf50' : '#333', display: 'inline-block' }} />
    {label}
  </span>
)

export default function SettingsPage() {
  const [form, setForm] = useState({
    default_provider: 'anthropic',
    default_model: '',
    anthropic_api_key: '',
    openai_api_key: '',
    notion_token: '',
    notion_page_id: '',
  })
  const [envStatus, setEnvStatus] = useState({ email: false, telegram: false })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(data => {
      const { _email_configured, _telegram_configured, ...rest } = data
      setForm(rest)
      setEnvStatus({ email: _email_configured, telegram: _telegram_configured })
    })
  }, [])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    await updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const PRESETS = {
    anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: '540px' }}>
      <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Settings</h1>
      <p style={{ color: '#444', fontSize: '12px', marginBottom: '28px' }}>Configure your LLM provider, API keys, and integrations.</p>

      <Section title="LLM Configuration">
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Default Provider</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['anthropic', 'openai'].map(p => (
              <button
                key={p}
                onClick={() => setForm(f => ({ ...f, default_provider: p }))}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s',
                  background: form.default_provider === p ? '#1e1a10' : '#0d0d0d',
                  border: `1px solid ${form.default_provider === p ? '#c9a96e' : '#222'}`,
                  color: form.default_provider === p ? '#c9a96e' : '#555',
                }}
              >
                {p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Default Model</label>
          <input
            type="text"
            value={form.default_model || ''}
            onChange={set('default_model')}
            placeholder={form.default_provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-6'}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #222', borderRadius: '4px', padding: '9px 12px', color: '#e0e0e0', fontSize: '13px', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#c9a96e'}
            onBlur={e => e.target.style.borderColor = '#222'}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {(PRESETS[form.default_provider || 'anthropic'] || []).map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, default_model: m }))} style={{
                background: form.default_model === m ? '#1e1a10' : 'transparent',
                border: `1px solid ${form.default_model === m ? '#c9a96e' : '#2a2a2a'}`,
                color: form.default_model === m ? '#c9a96e' : '#555',
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s'
              }}>{m}</button>
            ))}
          </div>
          <p style={{ color: '#383838', fontSize: '11px', margin: '8px 0 0' }}>Type any valid model name or pick a preset. Leave blank to use the provider default.</p>
        </div>
      </Section>

      <Section title="API Keys">
        <Field label="Anthropic API Key" value={form.anthropic_api_key} onChange={set('anthropic_api_key')} placeholder="sk-ant-..." type="password"
          hint="ANTHROPIC_API_KEY env var takes priority. Use this as a fallback or if not deploying to Railway." />
        <Field label="OpenAI API Key" value={form.openai_api_key} onChange={set('openai_api_key')} placeholder="sk-..." type="password"
          hint="Required only when using GPT models. Can also be set as OPENAI_API_KEY env var." />
      </Section>

      <Section title="Notion">
        <Field label="Integration Token" value={form.notion_token} onChange={set('notion_token')} placeholder="secret_..." type="password" />
        <Field label="Page ID" value={form.notion_page_id} onChange={set('notion_page_id')} placeholder="32-char hex from page URL"
          hint="Create integration at notion.so/my-integrations → share a page with it → copy the Page ID from the URL." />
      </Section>

      <Section title="Delivery (Email & Telegram)">
        <p style={{ color: '#555', fontSize: '12px', margin: '0 0 14px', lineHeight: '1.6' }}>
          Notification credentials are configured server-side via environment variables, not stored in the UI.
          Set these in your <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: '3px', color: '#888' }}>.env</code> file or Railway environment.
        </p>
        <div style={{ display: 'flex', gap: '16px', padding: '10px 12px', background: '#0d0d0d', borderRadius: '4px', border: '1px solid #1a1a1a' }}>
          <StatusDot active={envStatus.email} label="Email (Gmail)" />
          <StatusDot active={envStatus.telegram} label="Telegram" />
        </div>
        <p style={{ color: '#383838', fontSize: '11px', margin: '10px 0 0' }}>
          Variables: GMAIL_ADDRESS, GMAIL_APP_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
        </p>
      </Section>

      <button
        onClick={handleSave}
        style={{
          background: saved ? '#1a3a1a' : '#c9a96e',
          color: saved ? '#4caf50' : '#000',
          border: 'none', padding: '11px 28px', borderRadius: '4px',
          fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}
