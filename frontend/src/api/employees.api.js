// Employee API template: keep staff listing, profiles, and assignment requests here.
import apiClient from './client'

export const getEmployees = (params) => apiClient.get('/employees', { params })
