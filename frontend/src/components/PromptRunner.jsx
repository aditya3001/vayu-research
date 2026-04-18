import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getPrompt, runPrompt } from '../api'

const MODELS = {
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Best)' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Fast)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Cheapest)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Best)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
    { value: 'o1-mini', label: 'o1 Mini (Reasoning)' },
  ],
}

export default function PromptRunner() {
  const { promptId } = useParams()
  const [prompt, setPrompt] = useState(null)
  const [inputs, setInputs] = useState({})
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-opus-4-6')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTip, setShowTip] = useState(false)

  const handleProviderChange = (p) => {
    setProvider(p)
    setModel(MODELS[p][0].value)
  }

  useEffect(() => {
    getPrompt(promptId).then(p => {
      setPrompt(p)
      const defaults = {}
      ;(p.placeholders || []).forEach(k => { defaults[k] = '' })
      setInputs(defaults)
      setResult('')
    })
  }, [promptId])

  const handleRun = async () => {
    setLoading(true)
    setError('')
    setResult('')
    try {
      const data = await runPrompt(promptId, inputs, provider, model)
      setResult(data.result)
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

  if (!prompt) return <div style={{ padding: '24px', color: '#555' }}>Loading...</div>

  return (
    <div style={{ padding: '24px', maxWidth: '860px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#fff', fontSize: '20px', margin: '0 0 4px' }}>{prompt.name}</h1>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 8px' }}>{prompt.description}</p>
        <button
          onClick={() => setShowTip(!showTip)}
          style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '3px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
        >
          {showTip ? '▲' : '▼'} Pro Tip
        </button>
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Provider</label>
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px', color: '#fff', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px', color: '#fff', fontSize: '13px', outline: 'none', cursor: 'pointer', minWidth: '220px' }}
            >
              {MODELS[provider].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
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
            <div style={{ display: 'flex', gap: '8px' }}>
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
