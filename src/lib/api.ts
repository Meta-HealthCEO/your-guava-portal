import axios from 'axios'
import { clearAccessToken, getAccessToken, setAccessToken } from './accessToken'

const REQUEST_TIMEOUT_MS = 20_000
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

/**
 * A misconfigured deploy used to throw here, at module-evaluation time. This
 * module is imported by AuthContext, which main.tsx imports before it calls
 * render() — so the throw happened before React existed, ErrorBoundary never
 * saw it, and the result was a completely blank page whose only explanation
 * sat in the browser console. Whoever ran the deploy saw a dead site.
 *
 * The condition is still fatal, but it is now reported as a value so the app
 * can render the reason on screen. The build-time guard in vite.config.ts is
 * the real gate; this is the last line of defence.
 */
const detectConfigError = (): string | null => {
  if (!import.meta.env.PROD) return null
  if (!configuredApiUrl) return 'VITE_API_URL is not set. The portal does not know which API to talk to.'
  let parsed: URL
  try {
    parsed = new URL(configuredApiUrl)
  } catch {
    return `VITE_API_URL must be an absolute URL. It is currently "${configuredApiUrl}".`
  }
  if (parsed.protocol !== 'https:') {
    return `VITE_API_URL must use HTTPS in production. It is currently "${configuredApiUrl}".`
  }
  return null
}

export const API_CONFIG_ERROR = detectConfigError()

/**
 * Whether a failure means "this session is over" as opposed to "the request did
 * not get through". Only the server actually rejecting the credential counts.
 *
 * Everything else — a dropped connection, a CORS failure, a 5xx, a 429 from the
 * backend's refresh limiter, the 20-second timeout — used to be treated as a
 * dead session too, which hard-navigated the owner to /login and destroyed
 * whatever they were doing. On patchy mobile data that reads as an app that
 * logs you out at random, when in fact the refresh cookie was valid for another
 * seven days.
 */
export function isSessionRejection(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === 401 || status === 403
}

export const API_BASE_URL = (configuredApiUrl || '/api').replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
})

// Remove tokens left by earlier portal versions. Access tokens now live only
// in module memory; the durable session is the HttpOnly refresh cookie.
try {
  localStorage.removeItem('accessToken')
} catch {
  // Storage can be unavailable in hardened/private browser contexts.
}

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

// One lapsed-billing redirect per page load, however many requests hit the 402.
let billingRedirectIssued = false

export function refreshAccessToken() {
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
        setAccessToken(token)
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

  let response = await send(getAccessToken())
  if (response.status !== 401 || !shouldAttemptRefresh(path)) return response

  try {
    const token = await refreshAccessToken()
    response = await send(token)
    return response
  } catch (error) {
    // Only a rejected credential ends the session. A transport failure is
    // handed back to the caller so the page can offer a retry and keep state.
    if (isSessionRejection(error)) {
      clearAccessToken()
      window.location.assign('/login')
    }
    throw error
  }
}

// Request interceptor: attach the short-lived access token from module memory.
api.interceptors.request.use((config) => {
  const token = getAccessToken()
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
        // Same rule as authenticatedFetch: a refused credential ends the
        // session, a failed connection does not.
        if (isSessionRejection(refreshError)) {
          clearAccessToken()
          if (normaliseApiPath(original.url) !== '/auth/me') {
            window.location.href = '/login'
          }
        }
        return Promise.reject(refreshError)
      }
    }

    // A retried request that 401s again means the refreshed token is still not
    // accepted — an owner revoking a manager's access to the cafe that is still
    // their active one does exactly this. Without an exit the member sees every
    // page stuck on "could not load" with a Try again that can never work, and
    // no way back short of clearing site data.
    if (error.response?.status === 401 && original?._retry && shouldAttemptRefresh(original.url)) {
      clearAccessToken()
      if (normaliseApiPath(original.url) !== '/auth/me') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // The subscription has lapsed. The API answers every data request with a
    // structured 402, but without this branch each page just reports that its
    // data "could not load" and offers a Try again that can never succeed —
    // telling a paying customer the product is broken at exactly the moment
    // they need to be sent to the payment screen.
    if (error.response?.status === 402 && error.response?.data?.code === 'BILLING_REQUIRED') {
      // Suppress for the whole of Settings, not just the billing section. Only
      // /api/account and /api/auth are billing-exempt on the server, so loading
      // any other Settings section re-triggers the 402 — and the old check,
      // which required section=billing exactly, then bounced the user back to
      // billing with a full page reload. Every section became a reload trap
      // that discarded whatever was being edited.
      const onSettings = window.location.pathname.startsWith('/settings')
      // N concurrent requests produce N 402s; one navigation is enough.
      if (!onSettings && !billingRedirectIssued) {
        billingRedirectIssued = true
        window.location.href = '/settings?section=billing&billing=required'
      }
    }

    return Promise.reject(error)
  }
)

export default api
