// Stock-movement API template: connect inventory receipts, adjustments, and usage history.
import apiClient from './client'

export const getStockMovements = (params) => apiClient.get('/stock-movements', { params })
export const getStockMovement = (id) => apiClient.get(`/stock-movements/${id}`)
export const createStockMovement = (details) => apiClient.post('/stock-movements', details)
export const updateStockMovement = (id, details) =>
  apiClient.patch(`/stock-movements/${id}`, details)
export const deleteStockMovement = (id) => apiClient.delete(`/stock-movements/${id}`)
