import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api'

export default function SettingsPage() {
  const [form, setForm] = useState({ gmail_address: '', gmail_app_password: '', telegram_bot_token: '', telegram_chat_id: '', openai_api_key: '' })
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

  return (
    <div style={{ padding: '24px', maxWidth: '500px' }}>
      <h1 style={{ color: '#fff', fontSize: '20px', marginBottom: '24px' }}>Settings</h1>

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>OpenAI</h3>
        {field('openai_api_key', 'API Key', 'sk-...', 'password')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          Get your key at platform.openai.com → API Keys. Required to use GPT-4o and other OpenAI models.
        </p>
      </div>

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#c9a96e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginTop: 0 }}>Gmail (Email Delivery)</h3>
        {field('gmail_address', 'Gmail Address', 'you@gmail.com')}
        {field('gmail_app_password', 'App Password', 'xxxx xxxx xxxx xxxx', 'password')}
        <p style={{ color: '#444', fontSize: '11px', margin: 0 }}>
          Use a Gmail App Password (not your account password). Enable 2FA first, then generate at myaccount.google.com → Security → App Passwords.
        </p>
      </div>

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

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '14px', marginTop: '24px' }}>
        <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>
          <strong style={{ color: '#888' }}>ANTHROPIC_API_KEY</strong> is set as a Railway environment variable, not here.
        </p>
      </div>
    </div>
  )
}
