import { createContext, useContext, useEffect, useState } from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  exchangeCode as apiExchangeCode,
  refreshToken as apiRefreshToken,
  getAccessToken,
} from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns the parsed payload object, or null if decoding fails.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Build the user object from the currently stored access token.
 * Returns { id } where id is the numeric user id from the "sub" claim.
 * Returns null if no token is stored or decoding fails.
 */
function buildUserFromStoredToken() {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.sub) return null
  return { id: payload.sub }
}

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
      .then(() => {
        if (!cancelled) setUser(buildUserFromStoredToken())
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })

    return () => { cancelled = true }
  }, [])

  // ----- Auth actions -----

  const signupFn = async (email, password) => {
    await apiSignup(email, password)
    setUser(buildUserFromStoredToken())
  }

  const loginFn = async (email, password) => {
    await apiLogin(email, password)
    setUser(buildUserFromStoredToken())
  }

  const logoutFn = async () => {
    await apiLogout()
    setUser(null)
  }

  const handleOAuthCode = async (code) => {
    await apiExchangeCode(code)
    setUser(buildUserFromStoredToken())
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
