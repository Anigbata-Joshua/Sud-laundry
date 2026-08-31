// Service API template: connect laundry service catalog operations to backend routes.
import apiClient from './client'

export const getServices = () => apiClient.get('/services')
