// User API template: add administrator user management calls without coupling pages to Axios.
import apiClient from './client'

export const getUsers = (params) => apiClient.get('/users', { params })
