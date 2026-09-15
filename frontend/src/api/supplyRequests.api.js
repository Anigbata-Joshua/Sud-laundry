import apiClient from './client'

export const createSupplyRequest = (payload) => apiClient.post('/supply-requests', payload)
export const getSupplyRequests = (params) => apiClient.get('/supply-requests', { params })
export const approveSupplyRequest = (id, payload) =>
  apiClient.patch(`/supply-requests/${id}/approve`, payload)
export const rejectSupplyRequest = (id, payload) =>
  apiClient.patch(`/supply-requests/${id}/reject`, payload)