// Task API template: centralize operational task queries and status changes here.
import apiClient from './client'

export const getTasks = () => apiClient.get('/tasks')
export const updateTask = (id, details) => apiClient.patch(`/tasks/${id}`, details)
