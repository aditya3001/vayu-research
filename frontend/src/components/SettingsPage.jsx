import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getConfig } from '../api'

const Toggle = ({ checked, onChange }) => (
  <label className="s-toggle">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="s-slider" />
  </label>
)

const ConnectedDot = ({ active }) => (
  <span className={active ? 'status-connected' : 'status-disconnected'}>
    {active ? '● Connected' : '○ Not configured'}
  </span>
)

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notion_page_id: '', notion_page_id_from_env: false, auto_save_notion: false,
    notion_configured: false, email_configured: false, email_enabled: true,
    telegram_configured: false, telegram_enabled: true, openrouter_configured: false,
  })
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
    <div className="page" style={{ maxWidth: 580 }}>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">
        API keys live in{' '}
        <code style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', fontSize: 12 }}>.env</code>
        {' '}— only runtime preferences are here.
      </p>

      {/* Active Model */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="settings-section-label">Active Model</div>
        <div className="settings-card">
          <div className="settings-row">
            {activeConfig ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', flex: 1 }}>
                <span className="settings-model-chip">{activeConfig.model}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {{ anthropic: 'Anthropic', openai: 'OpenAI', openrouter: 'OpenRouter' }[activeConfig.provider] || activeConfig.provider}
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: 10, fontStyle: 'italic' }}>
                  via DEFAULT_MODEL in .env
                </span>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</span>
            )}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="settings-section-label">Integrations</div>
        <div className="settings-card">

          {/* Email */}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div className="settings-row-info">
                <div className="settings-row-title">Email</div>
                <div className="settings-row-sub">GMAIL_ADDRESS + GMAIL_APP_PASSWORD</div>
              </div>
              {settings.email_configured
                ? <Toggle checked={settings.email_enabled} onChange={v => save({ email_enabled: v })} />
                : <ConnectedDot active={false} />}
            </div>
            {settings.email_configured && !settings.email_enabled && (
              <div className="settings-notice warn" style={{ animation: 's-fade 0.2s ease' }}>
                Notifications paused — scheduled runs will not send emails
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div className="settings-row-info">
                <div className="settings-row-title">Telegram</div>
                <div className="settings-row-sub">TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID</div>
              </div>
              {settings.telegram_configured
                ? <Toggle checked={settings.telegram_enabled} onChange={v => save({ telegram_enabled: v })} />
                : <ConnectedDot active={false} />}
            </div>
            {settings.telegram_configured && !settings.telegram_enabled && (
              <div className="settings-notice warn" style={{ animation: 's-fade 0.2s ease' }}>
                Notifications paused — scheduled runs will not send Telegram messages
              </div>
            )}
          </div>

          {/* OpenRouter */}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div className="settings-row-info">
                <div className="settings-row-title">OpenRouter</div>
                <div className="settings-row-sub">OPENROUTER_API_KEY in .env — access any model</div>
              </div>
              <ConnectedDot active={settings.openrouter_configured} />
            </div>
            {settings.openrouter_configured && (
              <div className="settings-notice" style={{ animation: 's-fade 0.2s ease' }}>
                Set <code>DEFAULT_PROVIDER=openrouter</code> and <code>DEFAULT_MODEL=openrouter/auto</code> in .env to use auto-routing
              </div>
            )}
          </div>

          {/* Notion */}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div className="settings-row-info">
                <div className="settings-row-title">Notion</div>
                <div className="settings-row-sub">NOTION_TOKEN in .env</div>
              </div>
              <ConnectedDot active={settings.notion_configured} />
            </div>

            {settings.notion_configured && (
              <div style={{ animation: 's-fade 0.2s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Page ID</label>
                  {settings.notion_page_id_from_env && (
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic' }}>via NOTION_PAGE_ID env var</span>
                  )}
                </div>
                <input
                  className="settings-input"
                  value={settings.notion_page_id || ''}
                  onChange={e => !settings.notion_page_id_from_env && setSettings(s => ({ ...s, notion_page_id: e.target.value }))}
                  onBlur={e => !settings.notion_page_id_from_env && save({ notion_page_id: e.target.value })}
                  placeholder="32-char ID from page URL"
                  readOnly={settings.notion_page_id_from_env}
                />
                {!settings.notion_page_id_from_env && (
                  <p style={{ color: 'var(--text-faint)', fontSize: 11, margin: '5px 0 12px' }}>
                    Or set NOTION_PAGE_ID in .env to configure server-side.
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px var(--space-md)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Auto-save to Notion</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Save every result automatically after running</div>
                  </div>
                  <Toggle checked={settings.auto_save_notion} onChange={v => save({ auto_save_notion: v })} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {saved && (
        <div className="settings-saved">✓ Saved</div>
      )}
    </div>
  )
}
