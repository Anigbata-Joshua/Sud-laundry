// Leave-request API template: add employee leave submission and approval calls here.
import apiClient from './client'

export const getLeaveRequests = (params) => apiClient.get('/leave-requests', { params })
export const createLeaveRequest = (details) => apiClient.post('/leave-requests', details)
export const approveLeaveRequest = (id) => apiClient.put(`/leave-requests/${id}/approve`)
export const rejectLeaveRequest = (id, rejectionReason) =>
  apiClient.put(`/leave-requests/${id}/reject`, { rejection_reason: rejectionReason })
