// Notification API template: add read, unread, and dismissal actions here.
import apiClient from './client'

export const getNotifications = (params) => apiClient.get('/notifications', { params })
export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all')
