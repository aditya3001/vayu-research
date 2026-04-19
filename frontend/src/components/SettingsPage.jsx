import { useState, useEffect } from 'react'
import { getSettings, updateSettings, getConfig, testNotion } from '../api'


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
  const [settings, setSettings] = useState({ notion_page_id: '', notion_page_id_from_env: false, auto_save_notion: false, notion_configured: false, email_configured: false, email_enabled: true, telegram_configured: false, telegram_enabled: true })
  const [notionTest, setNotionTest] = useState(null)   // null | 'testing' | {ok, error?, page_title?}

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Page ID</label>
                      {settings.notion_page_id_from_env && (
                        <span style={{ color: '#383838', fontSize: '10px', fontStyle: 'italic' }}>via NOTION_PAGE_ID env var</span>
                      )}
                    </div>
                    <input
                      value={settings.notion_page_id || ''}
                      onChange={e => !settings.notion_page_id_from_env && setSettings(s => ({ ...s, notion_page_id: e.target.value }))}
                      onBlur={e => !settings.notion_page_id_from_env && save({ notion_page_id: e.target.value })}
                      placeholder="32-char ID from page URL"
                      readOnly={settings.notion_page_id_from_env}
                      style={{ width: '100%', boxSizing: 'border-box', background: settings.notion_page_id_from_env ? '#0a0a0a' : '#111', border: '1px solid #222', borderRadius: '4px', padding: '8px 12px', color: settings.notion_page_id_from_env ? '#555' : '#e0e0e0', fontSize: '12px', outline: 'none', fontFamily: 'monospace', cursor: settings.notion_page_id_from_env ? 'default' : 'text' }}
                      onFocus={e => { if (!settings.notion_page_id_from_env) e.target.style.borderColor = '#c9a96e' }}
                      onBlurCapture={e => e.target.style.borderColor = '#222'}
                    />
                    {!settings.notion_page_id_from_env && (
                      <p style={{ color: '#333', fontSize: '11px', margin: '5px 0 0' }}>Or set NOTION_PAGE_ID in .env to configure server-side.</p>
                    )}
                  </div>

                  {/* Test connection */}
                  <div style={{ marginBottom: '10px' }}>
                    <button
                      onClick={async () => {
                        setNotionTest('testing')
                        try { setNotionTest(await testNotion()) }
                        catch (e) { setNotionTest({ ok: false, error: e.response?.data?.detail || e.message }) }
                      }}
                      style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#777', padding: '7px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {notionTest === 'testing' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {notionTest && notionTest !== 'testing' && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', lineHeight: '1.5', animation: 's-fade 0.2s ease',
                        background: notionTest.ok ? '#0a1a0a' : '#1a0808',
                        border: `1px solid ${notionTest.ok ? '#1a3a1a' : '#3a1515'}`,
                        color: notionTest.ok ? '#4caf50' : '#ff6b6b'
                      }}>
                        {notionTest.ok ? `✓ Connected — "${notionTest.page_title}"` : `✗ ${notionTest.error}`}
                      </div>
                    )}
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
