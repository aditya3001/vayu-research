import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import api, {
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  signup,
  login,
  logout,
  exchangeCode,
  refreshToken,
} from './api.js'

// We need a fresh mock adapter for each test so interceptor state is clean.
let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  clearAccessToken()
})

afterEach(() => {
  mock.restore()
})

// ---------------------------------------------------------------------------
// 1. Token store round-trip
// ---------------------------------------------------------------------------
describe('token store', () => {
  it('setAccessToken / getAccessToken round-trip', () => {
    setAccessToken('tok-123')
    expect(getAccessToken()).toBe('tok-123')
  })

  it('clearAccessToken nulls the token', () => {
    setAccessToken('tok-123')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2 & 3. Request interceptor
// ---------------------------------------------------------------------------
describe('request interceptor', () => {
  it('attaches Authorization header when token is set', async () => {
    setAccessToken('my-token')
    mock.onGet('/api/prompts').reply((config) => {
      expect(config.headers.Authorization).toBe('Bearer my-token')
      return [200, []]
    })
    await api.get('/api/prompts')
  })

  it('omits Authorization header when token is null', async () => {
    // token is already null from beforeEach
    mock.onGet('/api/prompts').reply((config) => {
      expect(config.headers.Authorization).toBeUndefined()
      return [200, []]
    })
    await api.get('/api/prompts')
  })
})

// ---------------------------------------------------------------------------
// 4. 401 triggers refresh + retry
// ---------------------------------------------------------------------------
describe('response interceptor', () => {
  it('on 401 calls /api/auth/refresh and retries original request', async () => {
    setAccessToken('expired-token')

    let callCount = 0
    mock.onGet('/api/prompts').reply(() => {
      callCount++
      if (callCount === 1) return [401, { detail: 'Unauthorized' }]
      return [200, ['prompt1']]
    })
    mock.onPost('/api/auth/refresh').reply(200, { access_token: 'new-token' })

    const result = await api.get('/api/prompts')

    expect(result.data).toEqual(['prompt1'])
    expect(getAccessToken()).toBe('new-token')
    expect(callCount).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // 5. 401 on retry clears token and rejects
  // ---------------------------------------------------------------------------
  it('on 401 during retry, clears token and rejects without looping', async () => {
    setAccessToken('bad-token')

    // Both the original request and the refresh endpoint return 401
    mock.onGet('/api/prompts').reply(401)
    mock.onPost('/api/auth/refresh').reply(401)

    await expect(api.get('/api/prompts')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(getAccessToken()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6. signup
// ---------------------------------------------------------------------------
describe('signup', () => {
  it('POSTs to /api/auth/signup and stores access_token', async () => {
    mock.onPost('/api/auth/signup').reply(200, { access_token: 'signup-token' })

    await signup('user@example.com', 'secret')

    expect(getAccessToken()).toBe('signup-token')
    expect(mock.history.post[0].url).toBe('/api/auth/signup')
    const body = JSON.parse(mock.history.post[0].data)
    expect(body).toEqual({ email: 'user@example.com', password: 'secret' })
  })
})

// ---------------------------------------------------------------------------
// 7. login
// ---------------------------------------------------------------------------
describe('login', () => {
  it('POSTs to /api/auth/login and stores access_token', async () => {
    mock.onPost('/api/auth/login').reply(200, { access_token: 'login-token' })

    await login('user@example.com', 'secret')

    expect(getAccessToken()).toBe('login-token')
    expect(mock.history.post[0].url).toBe('/api/auth/login')
  })
})

// ---------------------------------------------------------------------------
// 8. logout
// ---------------------------------------------------------------------------
describe('logout', () => {
  it('POSTs to /api/auth/logout and clears token', async () => {
    setAccessToken('active-token')
    mock.onPost('/api/auth/logout').reply(200)

    await logout()

    expect(getAccessToken()).toBeNull()
    expect(mock.history.post[0].url).toBe('/api/auth/logout')
  })
})

// ---------------------------------------------------------------------------
// 9. exchangeCode
// ---------------------------------------------------------------------------
describe('exchangeCode', () => {
  it('POSTs to /api/auth/exchange with code and stores access_token', async () => {
    mock.onPost('/api/auth/exchange').reply(200, { access_token: 'exchange-token' })

    await exchangeCode('one-time-code-abc')

    expect(getAccessToken()).toBe('exchange-token')
    expect(mock.history.post[0].url).toBe('/api/auth/exchange')
    const body = JSON.parse(mock.history.post[0].data)
    expect(body).toEqual({ code: 'one-time-code-abc' })
  })
})
