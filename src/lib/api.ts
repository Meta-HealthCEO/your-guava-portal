import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

const REFRESH_EXCLUDED_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/change-password',
  '/auth/logout',
  '/auth/refresh',
])

function normaliseApiPath(url?: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url, api.defaults.baseURL || window.location.origin)
    return parsed.pathname.replace(/^\/api(?=\/)/, '')
  } catch {
    return url.replace(/^\/api(?=\/)/, '')
  }
}

function shouldAttemptRefresh(url?: string) {
  return !REFRESH_EXCLUDED_PATHS.has(normaliseApiPath(url))
}

// Request interceptor: attach access token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global refresh lock — prevents multiple concurrent refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (token) p.resolve(token)
    else p.reject(error)
  })
  failedQueue = []
}

// Response interceptor: on 401, try refresh (serialized) then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && shouldAttemptRefresh(original.url)) {
      original._retry = true
      original.headers = original.headers || {}

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              original.headers = original.headers || {}
              original.headers.Authorization = `Bearer ${token}`
              resolve(api(original))
            },
            reject,
          })
        })
      }

      isRefreshing = true
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newToken = data.accessToken
        localStorage.setItem('accessToken', newToken)
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
