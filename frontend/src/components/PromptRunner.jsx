import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getPrompt, runPrompt, saveToNotion } from '../api'

function PromptTextView({ text }) {
  // Render prompt text with [PLACEHOLDER] highlighted
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <pre style={{
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      color: '#999', fontSize: '12px', lineHeight: '1.7',
      margin: 0, fontFamily: 'inherit'
    }}>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part)
          ? <mark key={i} style={{ background: 'rgba(201,169,110,0.2)', color: '#c9a96e', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </pre>
  )
}

export default function PromptRunner() {
  const { promptId } = useParams()
  const [prompt, setPrompt] = useState(null)
  const [inputs, setInputs] = useState({})
  const [result, setResult] = useState('')
  const [historyId, setHistoryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTip, setShowTip] = useState(false)
  const [showPromptText, setShowPromptText] = useState(false)
  const [notionStatus, setNotionStatus] = useState('')

  useEffect(() => {
    getPrompt(promptId).then(p => {
      setPrompt(p)
      const defaults = {}
      ;(p.placeholders || []).forEach(k => { defaults[k] = '' })
      setInputs(defaults)
      setResult('')
      setHistoryId(null)
      setNotionStatus('')
    })
  }, [promptId])

  const handleRun = async () => {
    setLoading(true)
    setError('')
    setResult('')
    setHistoryId(null)
    setNotionStatus('')
    try {
      const data = await runPrompt(promptId, inputs)
      setResult(data.result)
      setHistoryId(data.history_id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
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

  if (!prompt) return <div style={{ padding: '24px', color: '#555' }}>Loading...</div>

  return (
    <div style={{ padding: '24px', maxWidth: '860px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#fff', fontSize: '20px', margin: '0 0 4px' }}>{prompt.name}</h1>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 10px' }}>{prompt.description}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowPromptText(!showPromptText)}
            style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
          >
            {showPromptText ? '▲ Hide Prompt' : '▼ View Prompt'}
          </button>
          <button
            onClick={() => setShowTip(!showTip)}
            style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
          >
            {showTip ? '▲' : '▼'} Pro Tip
          </button>
        </div>

        {showPromptText && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '4px', padding: '14px', marginTop: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
              Full Prompt — <span style={{ color: '#c9a96e' }}>highlighted</span> = placeholder fields
            </div>
            <PromptTextView text={prompt.prompt_text} />
          </div>
        )}

        {showTip && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '4px', padding: '10px', marginTop: '8px', color: '#c9a96e', fontSize: '12px' }}>
            {prompt.pro_tip}
          </div>
        )}
      </div>

      {/* Input Form */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          {(prompt.placeholders || []).map(key => (
            <div key={key} style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                {key}
              </label>
              <input
                value={inputs[key] || ''}
                onChange={e => setInputs({ ...inputs, [key]: e.target.value })}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px',
                  padding: '8px 10px', color: '#fff', fontSize: '13px', outline: 'none'
                }}
                placeholder={`Enter ${key.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          style={{
            background: loading ? '#555' : '#c9a96e',
            color: '#000', border: 'none', borderRadius: '4px',
            padding: '9px 24px', fontWeight: 700, fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Running...' : 'Run →'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#2a1111', border: '1px solid #4a2020', borderRadius: '4px', padding: '10px', color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Result</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {notionStatus === 'saved' && <span style={{ color: '#4caf50', fontSize: '11px' }}>✓ Saved to Notion</span>}
              {notionStatus && notionStatus !== 'saved' && notionStatus !== 'saving' && (
                <span style={{ color: '#ff6b6b', fontSize: '11px' }}>{notionStatus}</span>
              )}
              <button
                onClick={handleSaveToNotion}
                disabled={notionStatus === 'saving' || notionStatus === 'saved'}
                style={{ ...btnStyle, color: notionStatus === 'saved' ? '#4caf50' : '#888' }}
              >
                {notionStatus === 'saving' ? '...' : notionStatus === 'saved' ? '✓ Notion' : 'N Notion'}
              </button>
              <button onClick={handleDownload} style={btnStyle}>⬇ Download .md</button>
              <button onClick={handleCopy} style={btnStyle}>📋 Copy</button>
            </div>
          </div>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '20px', color: '#ccc', fontSize: '13px', lineHeight: '1.7' }}>
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = {
  background: '#1a1a1a', border: '1px solid #333', color: '#888',
  padding: '5px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
}
