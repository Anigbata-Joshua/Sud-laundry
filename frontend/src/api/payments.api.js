// Payment API template: keep payment history and transaction actions separate from page code.
import apiClient from './client'

export const getPayments = (params) => apiClient.get('/payments', { params })
