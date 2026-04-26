import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleOAuthCode } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      navigate('/login?error=missing_code', { replace: true })
      return
    }
    handleOAuthCode(code)
      .then(() => navigate('/', { replace: true }))
      .catch((e) => {
        const msg = e?.response?.data?.detail || e?.message || 'oauth_failed'
        navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}
