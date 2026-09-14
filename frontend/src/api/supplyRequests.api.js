import apiClient from './client'

export const createSupplyRequest = (payload) => apiClient.post('/supply-requests', payload)