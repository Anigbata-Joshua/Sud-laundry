// Payment API template: keep payment history and transaction actions separate from page code.
import apiClient from './client'

export const getPayments = (params) => apiClient.get('/payments', { params })
export const createPayment = (details) => apiClient.post('/payments', details)
export const refundPayment = (id, details) => apiClient.post(`/payments/${id}/refund`, details)
