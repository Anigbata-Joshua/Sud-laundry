// Notification API template: add read, unread, and dismissal actions here.
import apiClient from './client'

export const getNotifications = (params) => apiClient.get('/notifications', { params })
