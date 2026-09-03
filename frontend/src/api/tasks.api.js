// Task API template: centralize operational task queries and status changes here.
import apiClient from './client'

export const getTasks = () => apiClient.get('/tasks/get/all')
export const updateTask = (id, details) => apiClient.put(`/tasks/${id}/update`, details)
