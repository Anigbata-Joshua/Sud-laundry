// Leave-request API template: add employee leave submission and approval calls here.
import apiClient from './client'

export const getLeaveRequests = (params) => apiClient.get('/leave-requests', { params })
