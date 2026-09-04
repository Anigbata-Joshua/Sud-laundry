import apiClient from './client'

export const getRevenueSummary = (params) => apiClient.get('/reports/revenue', { params })

export const getRevenueTrend = (params) => apiClient.get('/reports/revenue-trend', { params })

export const getRevenueComparison = (params) =>
  apiClient.get('/reports/revenue-comparison', { params })

export const getPaymentMethods = (params) => apiClient.get('/reports/payment-methods', { params })

export const getOrderVolume = (params) => apiClient.get('/reports/order-volume', { params })

export const getTopCustomers = (params) => apiClient.get('/reports/top-customers', { params })

export const getTopServices = (params) => apiClient.get('/reports/top-services', { params })
