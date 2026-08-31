// Product API template: connect inventory products and stock-related operations here.
import apiClient from './client'

export const getProducts = (params) => apiClient.get('/products', { params })
