// Employee API template: keep staff listing, profiles, and assignment requests here.
import apiClient from './client'

export const getEmployees = () => apiClient.get('/employees')
export const getEmployee = (id) => apiClient.get(`/employees/${id}`)
export const createEmployee = (details) => apiClient.post('/employees', details)
export const updateEmployee = (id, details) => apiClient.patch(`/employees/${id}`, details)
export const deleteEmployee = (id) => apiClient.delete(`/employees/${id}`)
