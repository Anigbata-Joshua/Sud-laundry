// Order API foundation: add status updates, cancellation, and validation to this module.
import apiClient from './client'

export const getOrders = (params) => apiClient.get('/orders', { params })
export const getOrder = (id) => apiClient.get(`/orders/${id}`)
export const createOrder = (payload) => apiClient.post('/orders', payload)
export const updateOrder = (id, payload) => apiClient.patch(`/orders/${id}`, payload)
export const getMyOrders = (params) => apiClient.get('/orders/me', { params })
export const forceCancelOrder = (id, payload) =>
  apiClient.patch(`/orders/${id}/force-cancel`, payload)
