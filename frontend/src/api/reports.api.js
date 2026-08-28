// Report API template: keep report filters, exports, and summary requests here.
import apiClient from './client'

export const getReports = (params) => apiClient.get('/reports', { params })
