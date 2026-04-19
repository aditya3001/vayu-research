import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPrompt, runPrompt, saveToNotion, getConfig } from '../api'


const STATUS_MESSAGES = [
  'Sending request to model...',
  'Waiting for response...',
  'Generating analysis...',
  'Composing output...',
  'Almost there...',
]

function Loader({ elapsed, model }) {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % STATUS_MESSAGES.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: '28px 24px', animation: 'vr-fade-in 0.3s ease' }}>
      {/* Progress bar */}
      <div style={{ height: '2px', background: '#1a1a1a', borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, #c9a96e, #e8c47e)', borderRadius: '2px', animation: 'vr-bar 30s ease-out forwards' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Spinner */}
        <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid #1e1e1e', borderTopColor: '#c9a96e',
            borderRadius: '50%', animation: 'vr-spin 0.9s linear infinite'
          }} />
          <div style={{
            position: 'absolute', inset: '6px',
            border: '1.5px solid #1a1a1a', borderBottomColor: '#8a6a3e',
            borderRadius: '50%', animation: 'vr-spin 1.4s linear infinite reverse'
          }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: 500, marginBottom: '4px', animation: 'vr-fade-in 0.4s ease' }} key={msgIdx}>
            {STATUS_MESSAGES[msgIdx]}
          </div>
          <div style={{ color: '#444', fontSize: '11px' }}>
            {model && <span style={{ fontFamily: 'monospace', color: '#3a3a3a', marginRight: '8px' }}>{model.model}</span>}
            {elapsed < 5
              ? 'processing your request'
              : elapsed < 15
              ? `${elapsed}s — complex prompts take a moment`
              : `${elapsed}s — still working, please wait`}
          </div>
        </div>

        {/* Elapsed badge */}
        <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '4px', padding: '4px 10px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: '#c9a96e', fontSize: '16px', fontWeight: 600, lineHeight: 1 }}>{elapsed}</div>
          <div style={{ color: '#444', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>sec</div>
        </div>
      </div>

      {/* Animated dots */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '20px', paddingLeft: '52px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '5px', height: '5px', borderRadius: '50%', background: '#c9a96e',
            animation: `vr-dot 1.4s ease-in-out ${i * 0.16}s infinite`
          }} />
        ))}
      </div>
    </div>
  )
}

function PromptTextView({ text }) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#666', fontSize: '12px', lineHeight: '1.8', margin: 0, fontFamily: 'inherit' }}>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part)
          ? <mark key={i} style={{ background: 'rgba(201,169,110,0.15)', color: '#c9a96e', borderRadius: '3px', padding: '0 3px', fontWeight: 500 }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </pre>
  )
}

const PROVIDER_LABEL = { anthropic: 'Anthropic', openai: 'OpenAI' }
const PROVIDER_DEFAULT_MODEL = { anthropic: 'claude-opus-4-6', openai: 'gpt-4o' }

export default function PromptRunner() {
  const { promptId } = useParams()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(null)
  const [inputs, setInputs] = useState({})
  const [activeModel, setActiveModel] = useState(null)   // { provider, model } from settings
  const [result, setResult] = useState('')
  const [usedModel, setUsedModel] = useState(null)       // { provider, model } from last run response
  const [historyId, setHistoryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [showTip, setShowTip] = useState(false)
  const [showPromptText, setShowPromptText] = useState(false)
  const [notionStatus, setNotionStatus] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    getPrompt(promptId).then(p => {
      setPrompt(p)
      const defaults = {}
      ;(p.placeholders || []).forEach(k => { defaults[k] = '' })
      setInputs(defaults)
      setResult('')
      setHistoryId(null)
      setUsedModel(null)
      setNotionStatus('')
    })
  }, [promptId])

  useEffect(() => {
    getConfig().then(c => setActiveModel({ provider: c.provider, model: c.model }))
  }, [])

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  const stopTimer = () => {
    clearInterval(timerRef.current)
  }

  const handleRun = async () => {
    setLoading(true)
    setError('')
    setResult('')
    setHistoryId(null)
    setNotionStatus('')
    startTimer()
    try {
      const data = await runPrompt(promptId, inputs)
      setResult(data.result)
      setHistoryId(data.history_id)
      setUsedModel({ provider: data.provider, model: data.model })
      if (data.notion_saved) setNotionStatus('saved')
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
      stopTimer()
    }
  }

  const handleCopy = () => navigator.clipboard.writeText(result)

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${promptId}-result.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveToNotion = async () => {
    if (!historyId) return
    setNotionStatus('saving')
    try {
      await saveToNotion(historyId)
      setNotionStatus('saved')
    } catch (e) {
      setNotionStatus(e.response?.data?.detail || 'Notion save failed')
    }
  }

  if (!prompt) return <div style={{ padding: '24px', color: '#444' }}>Loading...</div>

  return (
    <>
      <div style={{ padding: '28px 24px', maxWidth: '860px' }}>

        {/* Header */}
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ color: '#fff', fontSize: '19px', fontWeight: 600, margin: '0 0 5px' }}>{prompt.name}</h1>
          <p style={{ color: '#555', fontSize: '13px', margin: '0 0 12px', lineHeight: '1.5' }}>{prompt.description}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowPromptText(!showPromptText)} style={ghostBtn}>
              {showPromptText ? '▲ Hide Prompt' : '▼ View Prompt'}
            </button>
            {prompt.pro_tip && (
              <button onClick={() => setShowTip(!showTip)} style={ghostBtn}>
                {showTip ? '▲' : '▼'} Pro Tip
              </button>
            )}
          </div>

          {showPromptText && (
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '16px', marginTop: '10px', maxHeight: '300px', overflowY: 'auto', animation: 'vr-fade-in 0.2s ease' }}>
              <div style={{ color: '#383838', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Full Prompt — <span style={{ color: '#c9a96e' }}>highlighted</span> fields are filled by your inputs
              </div>
              <PromptTextView text={prompt.prompt_text} />
            </div>
          )}

          {showTip && (
            <div style={{ background: '#110e06', border: '1px solid #2a2010', borderRadius: '6px', padding: '12px 14px', marginTop: '8px', color: '#c9a96e', fontSize: '12px', lineHeight: '1.6', animation: 'vr-fade-in 0.2s ease' }}>
              <span style={{ color: '#8a6a3e', fontWeight: 600, marginRight: '6px' }}>Pro Tip</span>
              {prompt.pro_tip}
            </div>
          )}
        </div>

        {/* Input Form */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '18px', marginBottom: '16px' }}>
          {(prompt.placeholders || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              {(prompt.placeholders || []).map(key => (
                <div key={key} style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ display: 'block', color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                    {key}
                  </label>
                  <input
                    value={inputs[key] || ''}
                    onChange={e => setInputs({ ...inputs, [key]: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #222', borderRadius: '4px', padding: '9px 10px', color: '#e0e0e0', fontSize: '13px', outline: 'none', transition: 'border-color 0.15s' }}
                    onFocus={e => e.target.style.borderColor = '#c9a96e'}
                    onBlur={e => e.target.style.borderColor = '#222'}
                    placeholder={`Enter ${key.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          )}

          {!loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={handleRun} style={{ background: '#c9a96e', color: '#000', border: 'none', borderRadius: '4px', padding: '10px 28px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.target.style.opacity = '0.85'}
                onMouseLeave={e => e.target.style.opacity = '1'}
              >
                Run →
              </button>
              {activeModel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#333', fontSize: '11px' }}>via</span>
                  <span style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                    {activeModel.model}
                  </span>
                  <span style={{ color: '#2a2a2a', fontSize: '11px' }}>·</span>
                  <button
                    onClick={() => navigate('/settings')}
                    style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: '11px', cursor: 'pointer', padding: '0', textDecoration: 'underline', textDecorationColor: '#2a2a2a' }}
                  >
                    change
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Loader elapsed={elapsed} model={activeModel} />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#1a0808', border: '1px solid #3a1515', borderRadius: '6px', padding: '12px 14px', color: '#ff6b6b', fontSize: '13px', marginBottom: '16px', animation: 'vr-fade-in 0.2s ease' }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ animation: 'vr-fade-in 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Result</span>
                {usedModel && (
                  <span style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '3px', padding: '2px 8px', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>
                    {PROVIDER_LABEL[usedModel.provider] || usedModel.provider} / {usedModel.model}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {notionStatus === 'saved' && <span style={{ color: '#4caf50', fontSize: '11px' }}>✓ Saved to Notion</span>}
                {notionStatus && notionStatus !== 'saved' && notionStatus !== 'saving' && (
                  <span style={{ color: '#ff6b6b', fontSize: '11px' }} title={notionStatus}>Notion failed</span>
                )}
                <button onClick={handleSaveToNotion} disabled={notionStatus === 'saving' || notionStatus === 'saved'} style={{ ...actionBtn, color: notionStatus === 'saved' ? '#4caf50' : '#666' }}>
                  {notionStatus === 'saving' ? '...' : 'Notion'}
                </button>
                <button onClick={handleDownload} style={actionBtn}>⬇ .md</button>
                <button onClick={handleCopy} style={actionBtn}>Copy</button>
              </div>
            </div>
            <div className="md" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '28px 32px' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const ghostBtn = {
  background: 'none', border: '1px solid #222', color: '#555',
  padding: '4px 11px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
}

const actionBtn = {
  background: '#111', border: '1px solid #222', color: '#666',
  padding: '5px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
}
