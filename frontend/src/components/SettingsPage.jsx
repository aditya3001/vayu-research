import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api'

export default function SettingsPage() {
  const [form, setForm] = useState({
    default_provider: 'anthropic',
    default_model: '',
    anthropic_api_key: '',
    openai_api_key: '',
    notion_token: '',
    notion_page_id: '',
    gmail_address: '',
    gmail_app_password: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { getSettings().then(setForm) }, [])

  const handleSave = async () => {
    await updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (key, label, placeholder, type = 'text') => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</label>
      <input
        type={type}
        value={form[key] || ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
      />
    </div>
  )

  const PROVIDER_MODELS = {
    anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  }

  return (
    <div style={{ padding: '24px', maxWidth: '540px' }}>
      <h1 style={{ color: '#fff', fontSize: '20px', marginBottom: '24px' }}>Settings</h1>

      {/* LLM Configuration */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>LLM Configuration</h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Default Provider</label>
          <select
            value={form.default_provider || 'anthropic'}
            onChange={e => setForm(f => ({ ...f, default_provider: e.target.value }))}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Default Model</label>
          <input
            type="text"
            value={form.default_model || ''}
            onChange={e => setForm(f => ({ ...f, default_model: e.target.value }))}
            placeholder={form.default_provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-6'}
            style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
          {(PROVIDER_MODELS[form.default_provider || 'anthropic'] || []).map(m => (
            <button
              key={m}
              onClick={() => setForm(f => ({ ...f, default_model: m }))}
              style={{
                background: form.default_model === m ? '#2a2010' : '#1a1a1a',
                border: `1px solid ${form.default_model === m ? '#c9a96e' : '#333'}`,
                color: form.default_model === m ? '#c9a96e' : '#666',
                padding: '3px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p style={{ color: '#444', fontSize: '11px', margin: '8px 0 0' }}>
          Type any model name or click a preset. Leave blank to use provider default.
        </p>
      </div>

      {/* API Keys */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>API Keys</h3>
        {field('anthropic_api_key', 'Anthropic API Key', 'sk-ant-...', 'password')}
        {field('openai_api_key', 'OpenAI API Key', 'sk-...', 'password')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          ANTHROPIC_API_KEY env var takes priority over the value entered here. OpenAI key is required only when using GPT models.
        </p>
      </div>

      {/* Notion */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>Notion</h3>
        {field('notion_token', 'Integration Token', 'secret_...', 'password')}
        {field('notion_page_id', 'Page ID', '32-char hex or URL ID')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          Create an integration at notion.so/my-integrations → get token → share a page with the integration → copy the page ID from its URL.
          Results will be appended as blocks to that page.
        </p>
      </div>

      {/* Gmail */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>Gmail (Email Delivery)</h3>
        {field('gmail_address', 'Gmail Address', 'you@gmail.com')}
        {field('gmail_app_password', 'App Password', 'xxxx xxxx xxxx xxxx', 'password')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          Use a Gmail App Password (not your account password). Enable 2FA first, then generate at myaccount.google.com → Security → App Passwords.
        </p>
      </div>

      {/* Telegram */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>Telegram</h3>
        {field('telegram_bot_token', 'Bot Token', '1234567890:AAH...')}
        {field('telegram_chat_id', 'Chat ID', '123456789')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          Create a bot via @BotFather on Telegram. Get your Chat ID by messaging @userinfobot.
        </p>
      </div>

      <button
        onClick={handleSave}
        style={{ background: saved ? '#2a4a2a' : '#c9a96e', color: saved ? '#4caf50' : '#000', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}
