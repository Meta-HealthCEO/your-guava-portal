import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosMock = vi.hoisted(() => {
  const requestUse = vi.fn()
  const responseUse = vi.fn()
  const instance = vi.fn((config) => Promise.resolve({ data: { retried: true }, config }))
  Object.assign(instance, {
    defaults: { baseURL: 'http://localhost:5000/api' },
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse },
    },
  })

  return {
    create: vi.fn(() => instance),
    post: vi.fn(),
    requestUse,
    responseUse,
    instance,
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosMock.create,
    post: axiosMock.post,
  },
}))

const loadApi = async () => {
  vi.resetModules()
  const mod = await import('./api')
  const requestHandler = axiosMock.requestUse.mock.calls[axiosMock.requestUse.mock.calls.length - 1]?.[0]
  const responseRejected = axiosMock.responseUse.mock.calls[axiosMock.responseUse.mock.calls.length - 1]?.[1]
  if (!requestHandler || !responseRejected) {
    throw new Error('API interceptors were not registered')
  }
  return { api: mod.default, requestHandler, responseRejected }
}

describe('api interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('configures axios with the API base URL and credentials', async () => {
    await loadApi()

    expect(axiosMock.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:5000/api',
      withCredentials: true,
    })
  })

  it('attaches the stored access token to outgoing requests', async () => {
    const { requestHandler } = await loadApi()
    localStorage.setItem('accessToken', 'access-token')

    const config = requestHandler({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer access-token')
  })

  it('does not refresh when login credentials are rejected', async () => {
    const { responseRejected } = await loadApi()
    const error = {
      config: { url: '/auth/login', headers: {} },
      response: { status: 401, data: { message: 'Invalid credentials' } },
    }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(axiosMock.instance).not.toHaveBeenCalled()
    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('does not refresh when change-password rejects the current password', async () => {
    const { responseRejected } = await loadApi()
    localStorage.setItem('accessToken', 'old-token')
    const error = {
      config: { url: 'http://localhost:5000/api/auth/change-password', headers: {} },
      response: { status: 401, data: { message: 'Current password is incorrect' } },
    }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(axiosMock.instance).not.toHaveBeenCalled()
    expect(localStorage.getItem('accessToken')).toBe('old-token')
  })

  it('refreshes and retries ordinary API requests after a 401', async () => {
    const { responseRejected } = await loadApi()
    axiosMock.post.mockResolvedValueOnce({ data: { accessToken: 'new-token' } })
    const original: { url: string; headers: Record<string, string> } = { url: '/account', headers: {} }

    await expect(responseRejected({ config: original, response: { status: 401 } })).resolves.toEqual(
      expect.objectContaining({ data: { retried: true } })
    )

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/refresh',
      {},
      { withCredentials: true }
    )
    expect(localStorage.getItem('accessToken')).toBe('new-token')
    expect(original.headers.Authorization).toBe('Bearer new-token')
    expect(axiosMock.instance).toHaveBeenCalledWith(original)
  })
})
