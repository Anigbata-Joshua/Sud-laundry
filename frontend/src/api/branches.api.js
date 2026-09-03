// Branch API template: centralize branch listing and management requests here.
import apiClient from './client'

export const getBranches = () => apiClient.get('/branches')
export const getBranch = (id) => apiClient.get(`/branches/${id}`)
export const createBranch = (details) => apiClient.post('/branches', details)
export const updateBranch = (id, details) => apiClient.put(`/branches/${id}`, details)
export const deleteBranch = (id) => apiClient.delete(`/branches/${id}`)
