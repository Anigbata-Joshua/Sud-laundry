// Branch API template: centralize branch listing and management requests here.
import apiClient from './client'

export const getBranches = () => apiClient.get('/branches')
