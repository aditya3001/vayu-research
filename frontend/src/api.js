import axios from 'axios'

// ---------------------------------------------------------------------------
// In-memory token store (never written to localStorage / sessionStorage)
// ---------------------------------------------------------------------------
let _accessToken = null

export const setAccessToken = (token) => { _accessToken = token }
export const getAccessToken = () => _accessToken
export const clearAccessToken = () => { _accessToken = null }

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const api = axios.create({
  // No baseURL — same-origin so relative paths work via the Vite proxy in dev
  // and the real server in prod.
  withCredentials: true, // required so the refresh_token httpOnly cookie is sent
})

// ---------------------------------------------------------------------------
// Request interceptor — attach access token if present
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`
  }
  return config
})

// ---------------------------------------------------------------------------
// Response interceptor — silent refresh on 401
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If we already retried once, or this IS the refresh call itself, give up.
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { data } = await api.post('/api/auth/refresh', null, { _retry: true })
        setAccessToken(data.access_token)
        // Update the header for the retry
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch (_refreshError) {
        clearAccessToken()
        return Promise.reject(_refreshError)
      }
    }

    return Promise.reject(error)
  },
)

// ---------------------------------------------------------------------------
// Auth API helpers
// ---------------------------------------------------------------------------
export const signup = async (email, password) => {
  const { data } = await api.post('/api/auth/signup', { email, password })
  setAccessToken(data.access_token)
  return data
}

export const login = async (email, password) => {
  const { data } = await api.post('/api/auth/login', { email, password })
  setAccessToken(data.access_token)
  return data
}

export const logout = async () => {
  await api.post('/api/auth/logout')
  clearAccessToken()
}

export const exchangeCode = async (code) => {
  const { data } = await api.post('/api/auth/exchange', { code })
  setAccessToken(data.access_token)
  return data
}

export const refreshToken = async () => {
  const { data } = await api.post('/api/auth/refresh')
  setAccessToken(data.access_token)
  return data.access_token
}

export const getMe = () => api.get('/api/auth/me').then(r => r.data)

// ---------------------------------------------------------------------------
// Non-auth API helpers (unchanged)
// ---------------------------------------------------------------------------
export const getPrompts = () => api.get('/api/prompts').then(r => r.data)
export const getPrompt = (id) => api.get(`/api/prompts/${id}`).then(r => r.data)
export const runPrompt = (prompt_id, inputs) =>
  api.post('/api/run', { prompt_id, inputs }).then(r => r.data)
export const saveToNotion = (id) => api.post(`/api/history/${id}/notion`).then(r => r.data)
export const getHistory = () => api.get('/api/history').then(r => r.data)
export const deleteHistory = (id) => api.delete(`/api/history/${id}`)
export const downloadHistory = async (id) => {
  const response = await api.get(`/api/history/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `research-${id}.md`
  a.click()
  URL.revokeObjectURL(url)
}
export const getSchedules = () => api.get('/api/schedules').then(r => r.data)
export const createSchedule = (data) => api.post('/api/schedules', data).then(r => r.data)
export const updateSchedule = (id, data) => api.put(`/api/schedules/${id}`, data).then(r => r.data)
export const deleteSchedule = (id) => api.delete(`/api/schedules/${id}`)
export const toggleSchedule = (id) => api.patch(`/api/schedules/${id}/toggle`).then(r => r.data)
export const getSettings = () => api.get('/api/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/api/settings', data).then(r => r.data)
export const getConfig = () => api.get('/api/config').then(r => r.data)
export const testNotion = () => api.get('/api/notion/test').then(r => r.data)
export const testNotionDbs = () => api.get('/api/notion/test-dbs').then(r => r.data)

export default api
