// Shared HTTP client: keep the API base URL and credential policy in one place.
// Extend interceptors here for authentication and normalized error handling.
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
})

export default apiClient
