// User API template: add administrator user management calls without coupling pages to Axios.
import apiClient from './client'

export const getUsers = (params) => apiClient.get('/users', { params })
export const getUser = (id) => apiClient.get(`/users/${id}`)
export const updateMyProfile = (details) => apiClient.patch('/users/me', details)
export const createUser = (details) => apiClient.post('/users', details)
export const updateUser = (id, details) => apiClient.patch(`/users/${id}`, details)
export const deleteUser = (id) => apiClient.delete(`/users/${id}`)
export const deactivateUser = (id) => apiClient.patch(`/users/${id}/deactivate`)
export const reactivateUser = (id) => apiClient.patch(`/users/${id}/reactivate`)
export const getCustomerReport = (id) => apiClient.get(`/users/${id}/customer-report`)
