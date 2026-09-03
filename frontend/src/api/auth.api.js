// Auth API template: add the backend's login, registration, and password endpoints here.
import apiClient from './client'

export const login = (credentials) => apiClient.post('/auth/login', credentials)
export const register = (details) => apiClient.post('/auth/register', details)
export const getCurrentUser = () => apiClient.get('/users/me')
