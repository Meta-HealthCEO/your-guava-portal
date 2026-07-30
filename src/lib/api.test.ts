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
  const tokenStore = await import('./accessToken')
  const requestHandler = axiosMock.requestUse.mock.calls[axiosMock.requestUse.mock.calls.length - 1]?.[0]
  const responseRejected = axiosMock.responseUse.mock.calls[axiosMock.responseUse.mock.calls.length - 1]?.[1]
  if (!requestHandler || !responseRejected) {
    throw new Error('API interceptors were not registered')
  }
  return {
    api: mod.default,
    authenticatedFetch: mod.authenticatedFetch,
    requestHandler,
    responseRejected,
    ...tokenStore,
  }
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
      timeout: 20_000,
    })
  })

  it('attaches the in-memory access token to outgoing requests', async () => {
    const { requestHandler, setAccessToken } = await loadApi()
    setAccessToken('access-token')

    const config = requestHandler({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer access-token')
  })

  it('removes a legacy persisted access token during migration', async () => {
    localStorage.setItem('accessToken', 'legacy-token')
    await loadApi()
    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('does not refresh when login credentials are rejected', async () => {
    const { responseRejected, getAccessToken } = await loadApi()
    const error = {
      config: { url: '/auth/login', headers: {} },
      response: { status: 401, data: { message: 'Invalid credentials' } },
    }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(axiosMock.instance).not.toHaveBeenCalled()
    expect(getAccessToken()).toBeNull()
  })

  it('does not refresh when change-password rejects the current password', async () => {
    const { responseRejected, setAccessToken, getAccessToken } = await loadApi()
    setAccessToken('old-token')
    const error = {
      config: { url: 'http://localhost:5000/api/auth/change-password', headers: {} },
      response: { status: 401, data: { message: 'Current password is incorrect' } },
    }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(axiosMock.instance).not.toHaveBeenCalled()
    expect(getAccessToken()).toBe('old-token')
  })

  it('refreshes and retries ordinary API requests after a 401', async () => {
    const { responseRejected, getAccessToken } = await loadApi()
    axiosMock.post.mockResolvedValueOnce({ data: { accessToken: 'new-token' } })
    const original: { url: string; headers: Record<string, string> } = { url: '/account', headers: {} }

    await expect(responseRejected({ config: original, response: { status: 401 } })).resolves.toEqual(
      expect.objectContaining({ data: { retried: true } })
    )

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/refresh',
      {},
      { withCredentials: true, timeout: 20_000 }
    )
    expect(getAccessToken()).toBe('new-token')
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(original.headers.Authorization).toBe('Bearer new-token')
    expect(axiosMock.instance).toHaveBeenCalledWith(original)
  })

  it('refreshes and retries an authenticated streaming fetch exactly once', async () => {
    const { authenticatedFetch, setAccessToken, getAccessToken } = await loadApi()
    setAccessToken('old-token')
    axiosMock.post.mockResolvedValueOnce({ data: { accessToken: 'stream-token' } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(authenticatedFetch('/forecasts/insights/chat/stream', { method: 'POST' }))
      .resolves.toEqual({ status: 200 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const retriedInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(new Headers(retriedInit.headers).get('Authorization')).toBe('Bearer stream-token')
    expect(getAccessToken()).toBe('stream-token')
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/refresh',
      {},
      { withCredentials: true, timeout: 20_000 }
    )
  })

  it('shares one refresh rotation between Axios and streaming requests', async () => {
    const {
      authenticatedFetch,
      responseRejected,
      setAccessToken,
      getAccessToken,
    } = await loadApi()
    setAccessToken('old-token')
    let finishRefresh!: (value: { data: { accessToken: string } }) => void
    axiosMock.post.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = resolve
    }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    const streamRetry = authenticatedFetch('/forecasts/insights/chat/stream', { method: 'POST' })
    const axiosRetry = responseRejected({
      config: { url: '/account', headers: {} },
      response: { status: 401 },
    })

    await vi.waitFor(() => expect(axiosMock.post).toHaveBeenCalledTimes(1))
    finishRefresh({ data: { accessToken: 'shared-token' } })
    await expect(Promise.all([streamRetry, axiosRetry])).resolves.toHaveLength(2)

    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(axiosMock.instance).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('shared-token')
  })

  it('times out while waiting for streaming response headers', async () => {
    const { authenticatedFetch } = await loadApi()
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        })
      ))

      const assertion = expect(authenticatedFetch('/forecasts/insights/chat/stream'))
        .rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(20_000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the header timeout after a stream connects but preserves caller cancellation', async () => {
    const { authenticatedFetch } = await loadApi()
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 })
      vi.stubGlobal('fetch', fetchMock)
      const caller = new AbortController()

      await authenticatedFetch('/forecasts/insights/chat/stream', { signal: caller.signal })
      const requestSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal

      await vi.advanceTimersByTimeAsync(20_001)
      expect(requestSignal.aborted).toBe(false)

      caller.abort()
      expect(requestSignal.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
