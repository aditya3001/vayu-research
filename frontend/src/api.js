import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getPrompts = () => api.get('/prompts').then(r => r.data)
export const getPrompt = (id) => api.get(`/prompts/${id}`).then(r => r.data)
export const runPrompt = (prompt_id, inputs) =>
  api.post('/run', { prompt_id, inputs }).then(r => r.data)
export const saveToNotion = (id) => api.post(`/history/${id}/notion`).then(r => r.data)
export const getHistory = () => api.get('/history').then(r => r.data)
export const deleteHistory = (id) => api.delete(`/history/${id}`)
export const downloadHistory = (id) => `/api/history/${id}/download`
export const getSchedules = () => api.get('/schedules').then(r => r.data)
export const createSchedule = (data) => api.post('/schedules', data).then(r => r.data)
export const updateSchedule = (id, data) => api.put(`/schedules/${id}`, data).then(r => r.data)
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`)
export const toggleSchedule = (id) => api.patch(`/schedules/${id}/toggle`).then(r => r.data)
export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data)
