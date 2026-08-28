// Task API template: centralize operational task queries and status changes here.
import apiClient from './client'

export const getTasks = (params) => apiClient.get('/tasks', { params })
