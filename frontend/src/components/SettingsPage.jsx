import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getConfig } from '../api'

const STYLES = `
  @keyframes s-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .s-toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
  .s-toggle input { opacity: 0; width: 0; height: 0; }
  .s-slider { position: absolute; inset: 0; background: #1e1e1e; border-radius: 22px; cursor: pointer; transition: background 0.2s; border: 1px solid #2a2a2a; }
  .s-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 2px; top: 2px; background: #444; border-radius: 50%; transition: all 0.2s; }
  input:checked + .s-slider { background: #1e1a10; border-color: #c9a96e; }
  input:checked + .s-slider::before { transform: translateX(18px); background: #c9a96e; }
`

const Toggle = ({ checked, onChange }) => (
  <label className="s-toggle">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="s-slider" />
  </label>
)

const ConnectedDot = ({ active }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: active ? '#4caf50' : '#444' }}>
    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: active ? '#4caf50' : '#2a2a2a', display: 'inline-block', boxShadow: active ? '0 0 6px #4caf5066' : 'none' }} />
    {active ? 'Connected' : 'Not configured'}
  </span>
)

export default function SettingsPage() {
  const [settings, setSettings] = useState({ notion_page_id: '', auto_save_notion: false, notion_configured: false, email_configured: false, email_enabled: true, telegram_configured: false, telegram_enabled: true })
  const [activeConfig, setActiveConfig] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
    getConfig().then(setActiveConfig)
  }, [])

  const save = async (patch) => {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    await updateSettings(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ padding: '32px 28px', maxWidth: '520px', animation: 's-fade 0.25s ease' }}>
        <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: '0 0 4px' }}>Settings</h1>
        <p style={{ color: '#383838', fontSize: '12px', margin: '0 0 32px' }}>
          API keys and secrets live in <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: '3px', color: '#666' }}>.env</code> — only runtime preferences are here.
        </p>

        {/* Active Model */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Active Model</div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeConfig ? (
              <>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#c9a96e', fontWeight: 500 }}>{activeConfig.model}</span>
                <span style={{ color: '#2a2a2a' }}>·</span>
                <span style={{ color: '#444', fontSize: '12px' }}>{activeConfig.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}</span>
                <span style={{ marginLeft: 'auto', color: '#2a2a2a', fontSize: '10px', fontStyle: 'italic' }}>via DEFAULT_MODEL in .env</span>
              </>
            ) : (
              <span style={{ color: '#333', fontSize: '12px' }}>Loading...</span>
            )}
          </div>
        </div>

        {/* Integrations */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Integrations</div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '8px', overflow: 'hidden' }}>

            {/* Email */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ccc', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Email</div>
                  <div style={{ color: '#383838', fontSize: '11px' }}>GMAIL_ADDRESS + GMAIL_APP_PASSWORD</div>
                </div>
                {settings.email_configured
                  ? <Toggle checked={settings.email_enabled} onChange={v => save({ email_enabled: v })} />
                  : <ConnectedDot active={false} />
                }
              </div>
              {settings.email_configured && !settings.email_enabled && (
                <div style={{ marginTop: '8px', color: '#5a4a1a', fontSize: '11px', background: '#1a1500', borderRadius: '4px', padding: '5px 10px', animation: 's-fade 0.2s ease' }}>
                  Notifications paused — scheduled runs will not send emails
                </div>
              )}
            </div>

            {/* Telegram */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ccc', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Telegram</div>
                  <div style={{ color: '#383838', fontSize: '11px' }}>TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID</div>
                </div>
                {settings.telegram_configured
                  ? <Toggle checked={settings.telegram_enabled} onChange={v => save({ telegram_enabled: v })} />
                  : <ConnectedDot active={false} />
                }
              </div>
              {settings.telegram_configured && !settings.telegram_enabled && (
                <div style={{ marginTop: '8px', color: '#5a4a1a', fontSize: '11px', background: '#1a1500', borderRadius: '4px', padding: '5px 10px', animation: 's-fade 0.2s ease' }}>
                  Notifications paused — scheduled runs will not send Telegram messages
                </div>
              )}
            </div>

            {/* Notion */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: settings.notion_configured ? '12px' : '0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ccc', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Notion</div>
                  <div style={{ color: '#383838', fontSize: '11px' }}>NOTION_TOKEN in .env</div>
                </div>
                <ConnectedDot active={settings.notion_configured} />
              </div>

              {settings.notion_configured && (
                <div style={{ animation: 's-fade 0.2s ease' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Page ID</label>
                    <input
                      value={settings.notion_page_id || ''}
                      onChange={e => setSettings(s => ({ ...s, notion_page_id: e.target.value }))}
                      onBlur={e => save({ notion_page_id: e.target.value })}
                      placeholder="32-char ID from page URL"
                      style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px 12px', color: '#e0e0e0', fontSize: '12px', outline: 'none', fontFamily: 'monospace' }}
                      onFocus={e => e.target.style.borderColor = '#c9a96e'}
                    />
                    <p style={{ color: '#333', fontSize: '11px', margin: '5px 0 0' }}>Paste the page ID from its Notion URL. The integration must be shared with this page.</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#111', borderRadius: '6px', border: '1px solid #1a1a1a' }}>
                    <div>
                      <div style={{ color: '#ccc', fontSize: '13px', fontWeight: 500 }}>Auto-save to Notion</div>
                      <div style={{ color: '#383838', fontSize: '11px', marginTop: '2px' }}>Save every result automatically after running</div>
                    </div>
                    <Toggle checked={settings.auto_save_notion} onChange={v => save({ auto_save_notion: v })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {saved && (
          <div style={{ color: '#4caf50', fontSize: '12px', animation: 's-fade 0.2s ease' }}>✓ Saved</div>
        )}
      </div>
    </>
  )
}
