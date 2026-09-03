// Task API template: centralize operational task queries and status changes here.
import apiClient from './client'

export const getTasks = (params) => apiClient.get('/tasks', { params })
export const getTask = (id) => apiClient.get(`/tasks/${id}`)
export const createTask = (details) => apiClient.post('/tasks', details)
export const updateTask = (id, details) => apiClient.patch(`/tasks/${id}`, details)
