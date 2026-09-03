// Service API template: connect laundry service catalog operations to backend routes.
import apiClient from './client'

export const getServices = (params) => apiClient.get('/services', { params })
export const getService = (id) => apiClient.get(`/services/${id}`)
export const createService = (details) => apiClient.post('/services', details)
export const updateService = (id, details) => apiClient.put(`/services/${id}`, details)
export const deleteService = (id) => apiClient.delete(`/services/${id}`)
