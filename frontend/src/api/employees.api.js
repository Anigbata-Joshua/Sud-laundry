// Employee API template: keep staff listing, profiles, and assignment requests here.
import apiClient from './client'

export const getEmployees = () => apiClient.get('/employees/get/all')
export const getEmployee = (id) => apiClient.get(`/employees/${id}/get/one`)
export const createEmployee = (details) => apiClient.post('/employees/create', details)
export const updateEmployee = (id, details) => apiClient.put(`/employees/${id}/update`, details)
export const deleteEmployee = (id) => apiClient.delete(`/employees/${id}`)
