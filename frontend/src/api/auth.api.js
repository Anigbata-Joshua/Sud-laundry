// Auth API template: add the backend's login, registration, and password endpoints here.
import apiClient from './client'

export const login = (credentials) => apiClient.post('/auth/login', credentials)
export const register = (details) => apiClient.post('/auth/register', details)
export const logout = () => apiClient.post('/auth/logout')
export const getCurrentUser = () => apiClient.get('/users/me')
export const forgotPassword = (details) => apiClient.post('/auth/forgot-password', details)
export const resetPassword = (details) => apiClient.post('/auth/reset-password', details)
