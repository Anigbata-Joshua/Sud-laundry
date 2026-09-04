// Supplier API template: centralize supplier records and purchasing requests here.
import apiClient from './client'

export const getSuppliers = (params) => apiClient.get('/suppliers', { params })
export const getSupplier = (id) => apiClient.get(`/suppliers/${id}`)
export const createSupplier = (details) => apiClient.post('/suppliers', details)
export const updateSupplier = (id, details) => apiClient.put(`/suppliers/${id}`, details)
export const deleteSupplier = (id) => apiClient.delete(`/suppliers/${id}`)
