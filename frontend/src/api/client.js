// Shared HTTP client: keep the API base URL and credential policy in one place.
// Extend interceptors here for authentication and normalized error handling.
import axios from 'axios'
import { storage } from '../utils/storage'

const SESSION_KEY = 'suds.admin.session'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3573/api/v1',
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(storage.get(SESSION_KEY))

    if (session?.token) {
      config.headers.Authorization = `Bearer ${session.token}`
    }
  } catch {
    storage.remove(SESSION_KEY)
  }

  return config
})

export default apiClient
