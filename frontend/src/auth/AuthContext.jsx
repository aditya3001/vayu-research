import { createContext, useContext, useEffect, useState } from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  exchangeCode as apiExchangeCode,
  refreshToken as apiRefreshToken,
  getMe,
} from '../api'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading; null = unauthenticated; object = authenticated
  const [user, setUser] = useState(undefined)

  // Derived boolean for callers that prefer an explicit flag
  const loading = user === undefined

  // ----- Session restore on mount -----
  useEffect(() => {
    let cancelled = false

    apiRefreshToken()
      .then(() => getMe())
      .then((u) => { if (!cancelled) setUser(u) })
      .catch(() => { if (!cancelled) setUser(null) })

    return () => { cancelled = true }
  }, [])

  // ----- Auth actions -----

  const signupFn = async (email, password) => {
    await apiSignup(email, password)
    setUser(await getMe())
  }

  const loginFn = async (email, password) => {
    await apiLogin(email, password)
    setUser(await getMe())
  }

  const logoutFn = async () => {
    await apiLogout()
    setUser(null)
  }

  const handleOAuthCode = async (code) => {
    await apiExchangeCode(code)
    setUser(await getMe())
  }

  // Keep signOut as an alias so any existing consumers using the old name still work
  const signOut = logoutFn

  return (
    <AuthContext.Provider value={{ user, loading, signupFn, loginFn, logoutFn, handleOAuthCode, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
