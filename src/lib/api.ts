import axios from 'axios'

const REQUEST_TIMEOUT_MS = 20_000
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error('VITE_API_URL is required for production builds')
}

if (import.meta.env.PROD && configuredApiUrl) {
  let productionApiUrl: URL
  try {
    productionApiUrl = new URL(configuredApiUrl)
  } catch {
    throw new Error('VITE_API_URL must be an absolute HTTPS URL for production builds')
  }
  if (productionApiUrl.protocol !== 'https:') {
    throw new Error('VITE_API_URL must use HTTPS for production builds')
  }
}

export const API_BASE_URL = (configuredApiUrl || '/api').replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
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

let refreshPromise: Promise<string> | null = null

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
      )
      .then(({ data }) => {
        const token = data?.accessToken
        if (!token || typeof token !== 'string') {
          throw new Error('Refresh response did not include an access token')
        }
        localStorage.setItem('accessToken', token)
        return token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}

/**
 * Fetch wrapper for streaming endpoints. It mirrors the Axios authentication
 * behaviour and retries exactly once after a successful refresh.
 */
export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    else headers.delete('Authorization')

    const headerTimeout = new AbortController()
    const signal = init.signal
      ? AbortSignal.any([init.signal, headerTimeout.signal])
      : headerTimeout.signal
    const timeoutId = window.setTimeout(() => headerTimeout.abort(), REQUEST_TIMEOUT_MS)

    try {
      // Clearing the timer as soon as fetch resolves bounds only the
      // connection/header wait. The caller's signal remains attached to the
      // response body so an established stream can still be cancelled.
      return await fetch(apiUrl(path), {
        ...init,
        credentials: 'include',
        headers,
        signal,
      })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  let response = await send(localStorage.getItem('accessToken'))
  if (response.status !== 401 || !shouldAttemptRefresh(path)) return response

  try {
    const token = await refreshAccessToken()
    response = await send(token)
    return response
  } catch (error) {
    localStorage.removeItem('accessToken')
    window.location.assign('/login')
    throw error
  }
}

// Request interceptor: attach access token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global refresh lock — prevents multiple concurrent refresh attempts
// Response interceptor: on 401, try refresh (serialized) then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && shouldAttemptRefresh(original.url)) {
      original._retry = true
      original.headers = original.headers || {}

      try {
        const newToken = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default api
