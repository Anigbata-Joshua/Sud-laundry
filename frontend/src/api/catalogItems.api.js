// Catalog items API: connect garment catalog & per-service pricing operations to backend routes.
import apiClient from './client'

export const getCatalogItems = (params) => apiClient.get('/catalog-items', { params })
export const getCatalogItem = (id) => apiClient.get(`/catalog-items/${id}`)
export const createCatalogItem = (details) => apiClient.post('/catalog-items', details)
export const updateCatalogItem = (id, details) => apiClient.patch(`/catalog-items/${id}`, details)
export const deleteCatalogItem = (id) => apiClient.delete(`/catalog-items/${id}`)
export const copyCatalogFromBranch = (payload) =>
  apiClient.post('/catalog-items/copy-from-branch', payload)
