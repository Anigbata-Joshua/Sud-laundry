// Shared HTTP client: keep the API base URL and credential policy in one place.
// Auth is handled by an httpOnly cookie the backend sets on login — the
// browser attaches it automatically because of withCredentials, so this
// client never touches or stores the token itself.
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3573/api/v1',
  withCredentials: true,
})

export default apiClient
