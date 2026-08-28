// Supplier API template: centralize supplier records and purchasing requests here.
import apiClient from './client'

export const getSuppliers = (params) => apiClient.get('/suppliers', { params })
