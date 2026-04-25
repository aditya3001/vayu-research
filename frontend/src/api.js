import axios from 'axios'
import { auth } from './auth/firebase'

const api = axios.create({ baseURL: '/api' })

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const getPrompts = () => api.get('/prompts').then(r => r.data)
export const getPrompt = (id) => api.get(`/prompts/${id}`).then(r => r.data)
export const runPrompt = (prompt_id, inputs) =>
  api.post('/run', { prompt_id, inputs }).then(r => r.data)
export const saveToNotion = (id) => api.post(`/history/${id}/notion`).then(r => r.data)
export const getHistory = () => api.get('/history').then(r => r.data)
export const deleteHistory = (id) => api.delete(`/history/${id}`)
export const downloadHistory = async (id) => {
  const response = await api.get(`/history/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `research-${id}.md`
  a.click()
  URL.revokeObjectURL(url)
}
export const getSchedules = () => api.get('/schedules').then(r => r.data)
export const createSchedule = (data) => api.post('/schedules', data).then(r => r.data)
export const updateSchedule = (id, data) => api.put(`/schedules/${id}`, data).then(r => r.data)
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`)
export const toggleSchedule = (id) => api.patch(`/schedules/${id}/toggle`).then(r => r.data)
export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data)
export const getConfig = () => api.get('/config').then(r => r.data)
export const testNotion = () => api.get('/notion/test').then(r => r.data)
export const testNotionDbs = () => api.get('/notion/test-dbs').then(r => r.data)
