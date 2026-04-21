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
    <div className="loader">
      <div className="loader-bar-track">
        <div className="loader-bar-fill" />
      </div>
      <div className="loader-body">
        <div className="loader-spinner">
          <div className="loader-ring-outer" />
          <div className="loader-ring-inner" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="loader-status" key={msgIdx} style={{ animation: 'vr-fade-in 0.4s ease' }}>
            {STATUS_MESSAGES[msgIdx]}
          </div>
          <div className="loader-meta">
            {model && <span style={{ marginRight: '8px' }}>{model.model}</span>}
            {elapsed < 5
              ? 'processing your request'
              : elapsed < 15
              ? `${elapsed}s — complex prompts take a moment`
              : `${elapsed}s — still working, please wait`}
          </div>
        </div>
        <div className="loader-elapsed">
          <div className="loader-elapsed-num">{elapsed}</div>
          <div className="loader-elapsed-unit">sec</div>
        </div>
      </div>
      <div className="loader-dots">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="loader-dot"
            style={{ animation: `vr-dot 1.4s ease-in-out ${i * 0.16}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

function PromptTextView({ text }) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.8', margin: 0, fontFamily: 'inherit' }}>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part)
          ? <mark key={i} style={{ background: 'var(--cat-quick-bg)', color: 'var(--cat-quick-text)', borderRadius: '3px', padding: '0 3px', fontWeight: 500 }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </pre>
  )
}

export default function PromptRunner() {
  const { promptId } = useParams()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(null)
  const [inputs, setInputs] = useState({})
  const [rawDates, setRawDates] = useState({})
  const [fullConfig, setFullConfig] = useState(null)
  const [activeModel, setActiveModel] = useState(null)
  const [result, setResult] = useState('')
  const [usedModel, setUsedModel] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [showPromptText, setShowPromptText] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [notionStatus, setNotionStatus] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    getPrompt(promptId).then(p => {
      setPrompt(p)
      const defaults = {}
      ;(p.placeholders || []).forEach(k => { defaults[k] = '' })
      setInputs(defaults)
      setRawDates({})
      setResult('')
      setHistoryId(null)
      setUsedModel(null)
      setNotionStatus('')
    })
  }, [promptId])

  useEffect(() => {
    if (!fullConfig) return
    const cat = prompt?.category || ''
    const catCfg = fullConfig.category_config?.[cat]
    const catModel = fullConfig.live_mode === 'live' ? catCfg?.live_model : catCfg?.demo_model
    if (catModel) {
      setActiveModel({ provider: catCfg.provider || fullConfig.provider, model: catModel })
    } else {
      setActiveModel({ provider: fullConfig.provider, model: fullConfig.model })
    }
  }, [prompt, fullConfig])

  useEffect(() => {
    getConfig().then(c => setFullConfig(c))
  }, [])

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  const stopTimer = () => clearInterval(timerRef.current)

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

  if (!prompt) return <div className="page" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="runner">
      {/* Left column — form */}
      <div className="runner-form">
        <button className="back-link" onClick={() => navigate('/')}>← Library</button>

        <span className={`cat-badge ${prompt.category}`}>
          {(prompt.category || '').replace(/-/g, ' ')}
        </span>
        <h1 className="runner-title">{prompt.name}</h1>
        {prompt.description && (
          <p className="runner-desc">{prompt.description}</p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => setShowPromptText(v => !v)}>
            {showPromptText ? '▲ Hide Prompt' : '▼ View Prompt'}
          </button>
          {prompt.pro_tip && (
            <button className="btn-ghost" onClick={() => setShowTip(v => !v)}>
              {showTip ? '▲' : '▼'} Pro Tip
            </button>
          )}
        </div>

        {showPromptText && (
          <div className="prompt-preview" style={{ animation: 'vr-fade-in 0.2s ease' }}>
            <div className="prompt-preview-label">
              Full prompt — <span style={{ color: 'var(--cat-quick-text)' }}>highlighted</span> = your inputs
            </div>
            <PromptTextView text={prompt.prompt_text} />
          </div>
        )}

        {showTip && (
          <div className="pro-tip" style={{ animation: 'vr-fade-in 0.2s ease' }}>
            <strong>Pro Tip — </strong>{prompt.pro_tip}
          </div>
        )}

        {(prompt.placeholders || []).length > 0 && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            {(prompt.placeholders || []).map(key => {
              const isDate = /^(date|insert date)$/i.test(key.trim())
              return (
                <div key={key}>
                  <label className="form-label">{key}</label>
                  <input
                    className="form-input"
                    type={isDate ? 'date' : 'text'}
                    value={isDate ? (rawDates[key] || '') : (inputs[key] || '')}
                    onChange={e => {
                      if (isDate) {
                        const raw = e.target.value
                        setRawDates(d => ({ ...d, [key]: raw }))
                        if (raw) {
                          const [y, m, day] = raw.split('-')
                          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                          setInputs(prev => ({ ...prev, [key]: `${parseInt(day)} ${months[parseInt(m)-1]} ${y}` }))
                        } else {
                          setInputs(prev => ({ ...prev, [key]: '' }))
                        }
                      } else {
                        setInputs(prev => ({ ...prev, [key]: e.target.value }))
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        <button className="btn-primary" onClick={handleRun} disabled={loading}>
          {loading ? 'Running…' : 'Run →'}
        </button>

        {activeModel && !loading && (
          <div className="model-pill">
            <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>via</span>
            <span className="model-tag">{activeModel.model}</span>
            <button className="model-change" onClick={() => navigate('/settings')}>change</button>
          </div>
        )}
      </div>

      {/* Right column — output */}
      <div className="runner-output">
        {loading && <Loader elapsed={elapsed} model={activeModel} />}

        {error && !loading && (
          <div className="error-box" style={{ animation: 'vr-fade-in 0.2s ease' }}>{error}</div>
        )}

        {result && !loading && (
          <div style={{ animation: 'vr-fade-in 0.3s ease' }}>
            <div className="output-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="output-label">Result</span>
                {usedModel && (
                  <span className="model-badge">{usedModel.provider} / {usedModel.model}</span>
                )}
              </div>
              <div className="action-bar">
                {notionStatus === 'saved' && <span className="success-text">✓ Saved to Notion</span>}
                {notionStatus && notionStatus !== 'saved' && notionStatus !== 'saving' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>Notion failed</span>
                )}
                <button
                  className="btn-action"
                  onClick={handleSaveToNotion}
                  disabled={notionStatus === 'saving' || notionStatus === 'saved'}
                >
                  {notionStatus === 'saving' ? '…' : 'Notion'}
                </button>
                <button className="btn-action" onClick={handleDownload}>⬇ .md</button>
                <button className="btn-action" onClick={handleCopy}>Copy</button>
              </div>
            </div>
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          </div>
        )}

        {!loading && !result && !error && (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            Fill in the form and click Run →
          </div>
        )}
      </div>
    </div>
  )
}
