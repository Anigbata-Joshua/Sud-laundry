// Stock-movement API template: connect inventory receipts, adjustments, and usage history.
import apiClient from './client'

export const getStockMovements = (params) => apiClient.get('/stock-movements', { params })
