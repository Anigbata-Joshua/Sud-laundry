import apiClient from './client'

export const getProcessingWorkflows = () => apiClient.get('/processing-workflows')
export const getOrderProcessingWorkflows = (orderId) =>
  apiClient.get(`/processing-workflows/order/${orderId}`)
export const createProcessingWorkflow = (details) =>
  apiClient.post('/processing-workflows', details)
export const updateProcessingStep = (workflowId, stepId, action) =>
  apiClient.patch(`/processing-workflows/${workflowId}/steps/${stepId}`, { action })
export const reviewProcessingQuality = (workflowId, result, notes) =>
  apiClient.patch(`/processing-workflows/${workflowId}/quality`, { result, notes })
