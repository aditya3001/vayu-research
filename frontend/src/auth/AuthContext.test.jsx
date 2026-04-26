// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

// ---------------------------------------------------------------------------
// Mock api.js — we control all exported functions
// ---------------------------------------------------------------------------
vi.mock('../api', () => ({
  refreshToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
  exchangeCode: vi.fn(),
  getAccessToken: vi.fn(),
}))

import * as api from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal JWT string whose payload encodes { sub: userId }.
 * The signature segment is a placeholder — we never verify it client-side.
 */
function makeToken(userId = 42) {
  const payload = btoa(JSON.stringify({ sub: userId, type: 'access' }))
    // btoa uses standard base64; JWT uses base64url — swap + and /
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `header.${payload}.sig`
}

/** Simple test component that renders the context values we care about. */
function TestConsumer() {
  const { user, loading } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user === null ? 'null' : user === undefined ? 'undefined' : JSON.stringify(user)}</span>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext', () => {
  // 1. loading is true initially, false after mount
  it('loading is true initially, false after mount resolves', async () => {
    let resolveRefresh
    api.refreshToken.mockReturnValue(new Promise((res) => { resolveRefresh = res }))
    api.getAccessToken.mockReturnValue(makeToken())

    renderWithProvider()

    // Before the promise resolves, loading should be true (user === undefined)
    expect(screen.getByTestId('loading').textContent).toBe('true')

    await act(async () => { resolveRefresh() })

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
  })

  // 2. refreshToken resolves → user is set
  it('sets user when refreshToken resolves', async () => {
    const token = makeToken(7)
    api.refreshToken.mockResolvedValue(token)
    api.getAccessToken.mockReturnValue(token)

    renderWithProvider()

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).not.toBe('undefined')
    )

    const user = JSON.parse(screen.getByTestId('user').textContent)
    expect(user).toMatchObject({ id: 7 })
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  // 3. refreshToken rejects → user is null, loading false
  it('sets user to null when refreshToken rejects', async () => {
    api.refreshToken.mockRejectedValue(new Error('no cookie'))

    renderWithProvider()

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('null')
    )
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  // 4. loginFn sets user on success
  it('loginFn sets user on success', async () => {
    // Startup: refresh fails → unauthenticated
    api.refreshToken.mockRejectedValue(new Error('no cookie'))

    let loginFn
    function CaptureLogin() {
      const ctx = useAuth()
      loginFn = ctx.loginFn
      return <TestConsumer />
    }

    render(
      <AuthProvider>
        <CaptureLogin />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('null')
    )

    const token = makeToken(99)
    api.login.mockResolvedValue(token)
    api.getAccessToken.mockReturnValue(token)

    await act(async () => { await loginFn('a@b.com', 'pass') })

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).not.toBe('null')
    )
    const user = JSON.parse(screen.getByTestId('user').textContent)
    expect(user).toMatchObject({ id: 99 })
  })

  // 5. loginFn throws on API error
  it('loginFn propagates error on API failure', async () => {
    api.refreshToken.mockRejectedValue(new Error('no cookie'))

    let loginFn
    function CaptureLogin() {
      const ctx = useAuth()
      loginFn = ctx.loginFn
      return <TestConsumer />
    }

    render(
      <AuthProvider>
        <CaptureLogin />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('null')
    )

    api.login.mockRejectedValue(new Error('401 Unauthorized'))

    await expect(
      act(async () => { await loginFn('bad@b.com', 'wrong') })
    ).rejects.toThrow('401 Unauthorized')

    // user should remain null after the failed login
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  // 6. logoutFn clears user
  it('logoutFn sets user to null', async () => {
    const token = makeToken(5)
    api.refreshToken.mockResolvedValue(token)
    api.getAccessToken.mockReturnValue(token)

    let logoutFn
    function CaptureLogout() {
      const ctx = useAuth()
      logoutFn = ctx.logoutFn
      return <TestConsumer />
    }

    render(
      <AuthProvider>
        <CaptureLogout />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).not.toBe('undefined')
    )

    api.logout.mockResolvedValue(undefined)

    await act(async () => { await logoutFn() })

    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  // 7. handleOAuthCode sets user
  it('handleOAuthCode sets user from exchanged token', async () => {
    api.refreshToken.mockRejectedValue(new Error('no cookie'))

    let handleOAuthCode
    function CaptureOAuth() {
      const ctx = useAuth()
      handleOAuthCode = ctx.handleOAuthCode
      return <TestConsumer />
    }

    render(
      <AuthProvider>
        <CaptureOAuth />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('null')
    )

    const token = makeToken(13)
    api.exchangeCode.mockResolvedValue(token)
    api.getAccessToken.mockReturnValue(token)

    await act(async () => { await handleOAuthCode('oauth-code-xyz') })

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).not.toBe('null')
    )
    const user = JSON.parse(screen.getByTestId('user').textContent)
    expect(user).toMatchObject({ id: 13 })
  })
})
