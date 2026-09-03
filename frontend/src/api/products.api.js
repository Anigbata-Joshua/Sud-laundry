// Product API template: connect inventory products and stock-related operations here.
import apiClient from './client'

export const getProducts = (params) => apiClient.get('/products', { params })
export const getProduct = (id, params) => apiClient.get(`/products/${id}`, { params })
export const createProduct = (details) => apiClient.post('/products', details)
export const updateProduct = (id, details) => apiClient.patch(`/products/${id}`, details)
export const deleteProduct = (id) => apiClient.delete(`/products/${id}`)
