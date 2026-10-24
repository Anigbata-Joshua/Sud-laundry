import apiClient from './client'

export const getProcessingWorkflows = (params) => apiClient.get('/processing-workflows', { params })
export const getOrderProcessingWorkflows = (orderId) =>
  apiClient.get(`/processing-workflows/order/${orderId}`)
export const createProcessingWorkflow = (details) =>
  apiClient.post('/processing-workflows', details)
export const updateProcessingStep = (workflowId, stepId, action) =>
  apiClient.patch(`/processing-workflows/${workflowId}/steps/${stepId}`, { action })
export const reviewProcessingQuality = (workflowId, result, notes) =>
  apiClient.patch(`/processing-workflows/${workflowId}/quality`, { result, notes })
export const reassignProcessingWorkflow = (workflowId, employee_id) =>
  apiClient.post(`/processing-workflows/${workflowId}/reassign`, { employee_id })
export const getAttendantsAvailability = (branchId, orderId) =>
  apiClient.get(`/processing-workflows/branch/${branchId}/attendants`, {
    params: orderId ? { orderId } : {},
  })
