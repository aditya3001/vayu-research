import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getConfig } from '../api'

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
  const [form, setForm] = useState({ anthropic_api_key: '', openai_api_key: '', notion_token: '', notion_page_id: '' })
  const [envStatus, setEnvStatus] = useState({ email: false, telegram: false })
  const [activeConfig, setActiveConfig] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(data => {
      const { _email_configured, _telegram_configured, ...rest } = data
      setForm(rest)
      setEnvStatus({ email: _email_configured, telegram: _telegram_configured })
    })
    getConfig().then(setActiveConfig)
  }, [])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    await updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: '540px' }}>
      <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Settings</h1>
      <p style={{ color: '#444', fontSize: '12px', marginBottom: '28px' }}>API keys and integrations. LLM model is configured via environment variables.</p>

      {/* Active model read-only display */}
      {activeConfig && (
        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#383838', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Model</span>
          <span style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', color: '#c9a96e', fontFamily: 'monospace' }}>
            {activeConfig.model}
          </span>
          <span style={{ color: '#2a2a2a', fontSize: '11px' }}>·</span>
          <span style={{ color: '#383838', fontSize: '11px' }}>{activeConfig.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}</span>
          <span style={{ marginLeft: 'auto', color: '#2a2a2a', fontSize: '10px' }}>set via DEFAULT_MODEL env var</span>
        </div>
      )}

      <Section title="API Keys">
        <Field label="Anthropic API Key" value={form.anthropic_api_key} onChange={set('anthropic_api_key')} placeholder="sk-ant-..." type="password"
          hint="ANTHROPIC_API_KEY env var takes priority over this value." />
        <Field label="OpenAI API Key" value={form.openai_api_key} onChange={set('openai_api_key')} placeholder="sk-..." type="password"
          hint="Required only when DEFAULT_PROVIDER=openai. Can also be set as OPENAI_API_KEY env var." />
      </Section>

      <Section title="Notion">
        <Field label="Integration Token" value={form.notion_token} onChange={set('notion_token')} placeholder="secret_..." type="password" />
        <Field label="Page ID" value={form.notion_page_id} onChange={set('notion_page_id')} placeholder="32-char hex from page URL"
          hint="Create integration at notion.so/my-integrations → share a page with it → copy the Page ID from the URL." />
      </Section>

      <Section title="Delivery (Email & Telegram)">
        <p style={{ color: '#555', fontSize: '12px', margin: '0 0 14px', lineHeight: '1.6' }}>
          Configured via environment variables only.
          Set these in your <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: '3px', color: '#888' }}>.env</code> file or Railway dashboard.
        </p>
        <div style={{ display: 'flex', gap: '16px', padding: '10px 12px', background: '#0d0d0d', borderRadius: '4px', border: '1px solid #1a1a1a' }}>
          <StatusDot active={envStatus.email} label="Email (Gmail)" />
          <StatusDot active={envStatus.telegram} label="Telegram" />
        </div>
        <p style={{ color: '#383838', fontSize: '11px', margin: '10px 0 0' }}>
          GMAIL_ADDRESS · GMAIL_APP_PASSWORD · TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID
        </p>
      </Section>

      <button
        onClick={handleSave}
        style={{ background: saved ? '#1a3a1a' : '#c9a96e', color: saved ? '#4caf50' : '#000', border: 'none', padding: '11px 28px', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}
