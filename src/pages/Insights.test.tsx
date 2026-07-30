import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import Insights from './Insights'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock the api module
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/lib/api', () => {
  return {
    authenticatedFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      patch: (...args: unknown[]) => mockPatch(...args),
      put: vi.fn(),
      delete: (...args: unknown[]) => mockDelete(...args),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

const CHAT_SCOPE_ID = 'u1:org1:c1'
const CHAT_STORAGE_KEY = `your-guava:insights-chat:v2:${CHAT_SCOPE_ID}`
const CHAT_LIST_STORAGE_KEY = `your-guava:insights-chat-list:v2:${CHAT_SCOPE_ID}`
const testUser = {
  id: 'u1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'owner' as const,
  orgId: 'org1',
  cafeIds: ['c1'],
  activeCafeId: 'c1',
}

function render(ui: React.ReactElement) {
  return rtlRender(
    <BrowserRouter>
      <AuthContext.Provider value={{
        user: testUser,
        isLoading: false,
        isOwner: true,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        switchCafe: vi.fn(),
      }}>
        {ui}
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

const contextStats = {
  transactionCount: 12,
  locations: 1,
  topItems: 4,
  forecasts: 3,
}

function chat(overrides: Partial<{
  _id: string
  title: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  archived: boolean
}> = {}) {
  return {
    _id: overrides._id || 'chat-1',
    title: overrides.title || 'Saved chat',
    messages: overrides.messages || [
      { id: 'user-1', role: 'user' as const, content: 'Saved question' },
      { id: 'assistant-1', role: 'assistant' as const, content: 'Saved answer' },
    ],
    contextStats,
    archived: overrides.archived ?? false,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function storeActiveChat(savedChat: ReturnType<typeof chat>) {
  localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify({
      scopeId: CHAT_SCOPE_ID,
      activeChatId: savedChat._id,
      messages: savedChat.messages,
      contextStats: savedChat.contextStats,
    })
  )
  localStorage.setItem(CHAT_LIST_STORAGE_KEY, JSON.stringify({ scopeId: CHAT_SCOPE_ID, chats: [savedChat] }))
}

function mockBaseRequests(chats: Array<ReturnType<typeof chat>> = []) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/cafe/me')) {
      return Promise.resolve({ data: { cafe: { name: 'Test' } } })
    }
    if (url.includes('/cafe/list')) {
      return Promise.resolve({ data: { success: true, cafes: [] } })
    }
    if (url.includes('/insight-chats')) {
      return Promise.resolve({ data: { chats } })
    }
    if (url.includes('/forecasts/insights')) {
      return Promise.reject(new Error('No key'))
    }
    return Promise.resolve({ data: {} })
  })
}

function streamResponse(body: string): Response {
  let delivered = false
  const value = new TextEncoder().encode(body)
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => {
          if (delivered) return Promise.resolve({ done: true, value: undefined })
          delivered = true
          return Promise.resolve({ done: false, value })
        },
      }),
    },
  } as unknown as Response
}

describe('Insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, body: null }))
  })

  it('renders insight cards from the API', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/insights')) {
        return Promise.resolve({
          data: {
            insights: [
              'Flat White sales spike 34% on payday Fridays.',
              'Croissant sales dropped 18% over the last 3 Sundays.',
              'Morning rush generates 36% of your daily revenue.',
              'Cold Brew sales are trending up 22% month-on-month.',
            ],
            generatedAt: new Date().toISOString(),
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText(/flat white sales spike/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/croissant sales dropped/i)).toBeInTheDocument()
    expect(screen.getByText(/morning rush generates/i)).toBeInTheDocument()
    expect(screen.getByText(/cold brew sales are trending/i)).toBeInTheDocument()
  })

  it('shows an honest error state instead of fabricated insights when the API fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('No key'))
    })

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText(/insights are unavailable right now/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/flat white sales spike/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<Insights />)

    const skeletons = document.querySelectorAll('[class*="skeleton-shimmer"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows the metered refresh cost', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('No key'))
    })

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh \(10 credits\)/i })).toBeInTheDocument()
    })
  })

  it('uses the read-only endpoint on load without spending credits', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/insights')) {
        return Promise.resolve({
          data: {
            success: true,
            insights: [],
            generatedAt: null,
            requiresRefresh: true,
            cacheStatus: 'empty',
          },
        })
      }
      if (url.includes('/insight-chats')) return Promise.resolve({ data: { chats: [] } })
      return Promise.resolve({ data: {} })
    })

    render(<Insights />)

    expect(await screen.findByText('No generated insights yet')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/forecasts/insights')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('refreshes through the metered POST and reuses its idempotency key on retry', async () => {
    const generatedAt = '2026-07-30T08:00:00.000Z'
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/insights')) {
        return Promise.resolve({
          data: {
            success: true,
            insights: ['Saved analysis'],
            generatedAt,
            requiresRefresh: true,
            cacheStatus: 'stale',
          },
        })
      }
      if (url.includes('/insight-chats')) return Promise.resolve({ data: { chats: [] } })
      return Promise.resolve({ data: {} })
    })
    mockPost
      .mockRejectedValueOnce(new Error('network interrupted'))
      .mockResolvedValueOnce({
        data: {
          success: true,
          insights: ['Refreshed analysis'],
          generatedAt,
          requiresRefresh: false,
          guavaCredits: { available: 90 },
          aiCredits: { available: 90 },
          meta: { replayed: true, coalesced: false },
        },
      })

    render(<Insights />)

    await userEvent.click(await screen.findByRole('button', { name: /refresh \(10 credits\)/i }))
    expect(await screen.findByText(/could not refresh insights/i)).toBeInTheDocument()

    const firstConfig = mockPost.mock.calls[0][2] as { headers: { 'Idempotency-Key': string } }
    const firstKey = firstConfig.headers['Idempotency-Key']
    expect(firstKey).toBeTruthy()
    expect(firstKey.length).toBeLessThanOrEqual(160)

    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }))

    expect(await screen.findByText('Refreshed analysis')).toBeInTheDocument()
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[0][0]).toBe('/forecasts/insights/refresh')
    expect(mockPost.mock.calls[0][1]).toEqual({})
    expect(mockPost.mock.calls[1][2].headers['Idempotency-Key']).toBe(firstKey)
  })

  it('shows category badges on insights', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/insights')) {
        return Promise.resolve({
          data: {
            insights: ['First insight', 'Second insight', 'Third insight', 'Fourth insight'],
            generatedAt: new Date().toISOString(),
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Insights />)

    await waitFor(() => {
      // Categories cycle trend → warning → tip → highlight
      expect(screen.getAllByText('Trend').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByText('Watch')).toBeInTheDocument()
    expect(screen.getByText('Tip')).toBeInTheDocument()
    expect(screen.getByText('Highlight')).toBeInTheDocument()
  })

  it('restores saved chat messages', async () => {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        scopeId: CHAT_SCOPE_ID,
        messages: [
          { id: 'user-saved', role: 'user', content: 'Saved question' },
          { id: 'assistant-saved', role: 'assistant', content: '# Saved answer\n\n**Bold result**' },
        ],
      })
    )
    mockGet.mockRejectedValue(new Error('No key'))

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Saved question')).toBeInTheDocument()
    })

    expect(screen.getByText('Saved answer')).toBeInTheDocument()
    expect(screen.getByText('Bold result')).toBeInTheDocument()
  })

  it('opens a restored chat at the latest message', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })

    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        scopeId: CHAT_SCOPE_ID,
        activeChatId: 'saved-chat',
        messages: [
          { id: 'user-saved-1', role: 'user', content: 'First saved question' },
          { id: 'assistant-saved-1', role: 'assistant', content: 'First saved answer' },
          { id: 'user-saved-2', role: 'user', content: 'Latest saved question' },
          { id: 'assistant-saved-2', role: 'assistant', content: 'Latest saved answer' },
        ],
        contextStats,
      })
    )
    mockBaseRequests()

    render(<Insights />)

    expect(await screen.findByText('Latest saved answer')).toBeInTheDocument()
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
    })
  })

  it('sends the first prompt in a fresh chat and renders the assistant response', async () => {
    mockBaseRequests()
    mockPost.mockImplementation((url: string, payload: { title?: string; messages?: unknown[] }) => {
      if (url === '/insight-chats') {
        return Promise.resolve({
          data: {
            chat: chat({
              _id: 'chat-first',
              title: payload.title || 'First chat',
              messages: payload.messages as ReturnType<typeof chat>['messages'],
            }),
          },
        })
      }
      if (url === '/forecasts/insights/chat') {
        return Promise.resolve({
          data: {
            answer: 'You sold the most flat whites this week.',
            contextStats,
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
    mockPatch.mockImplementation((url: string, payload: { title?: string; messages?: unknown[] }) =>
      Promise.resolve({
        data: {
          chat: chat({
            _id: url.split('/').pop() || 'chat-first',
            title: payload.title || 'First chat',
            messages: payload.messages as ReturnType<typeof chat>['messages'],
          }),
        },
      })
    )

    render(<Insights />)

    const input = await screen.findByPlaceholderText(/how can i help/i)
    await userEvent.type(input, 'What are my best sellers?')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/forecasts/insights/chat',
        { messages: [{ role: 'user', content: 'What are my best sellers?' }] },
        { headers: { 'Idempotency-Key': expect.stringMatching(/^ask-guava-/) } }
      )
    })
    const userPrompt = screen
      .getAllByText('What are my best sellers?')
      .find((element) => element.closest('[data-message-role="user"]'))
    expect(userPrompt?.closest('[data-message-role="user"]')).toBeInTheDocument()

    const assistantReply = await screen.findByText(/flat whites/i)
    expect(assistantReply.closest('[data-message-role="assistant"]')).toBeInTheDocument()
  })

  it('does not save a partial stream without done', async () => {
    mockBaseRequests()
    vi.mocked(fetch).mockResolvedValue(streamResponse(
      'event: delta\ndata: ' + JSON.stringify({ text: 'Partial answer' }) + '\n\n'
    ))
    mockPost.mockResolvedValue({ data: { chat: chat({ _id: 'chat-partial' }) } })
    render(<Insights />)
    const input = await screen.findByPlaceholderText(/how can i help/i)
    await userEvent.type(input, 'Interrupt this answer')
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/partial answer/i)).toBeInTheDocument()
    expect(await screen.findByText(/stream stopped before it finished/i)).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPost.mock.calls.some(([url]) => url === '/forecasts/insights/chat')).toBe(false)
  })

  it('does not save partial output followed by an SSE error event', async () => {
    mockBaseRequests()
    const body = 'event: delta\ndata: ' + JSON.stringify({ text: 'Partial error answer' })
      + '\n\nevent: error\ndata: ' + JSON.stringify({ message: 'Provider failed' }) + '\n\n'
    vi.mocked(fetch).mockResolvedValue(streamResponse(body))
    mockPost.mockResolvedValue({ data: { chat: chat({ _id: 'chat-error' }) } })
    render(<Insights />)
    const input = await screen.findByPlaceholderText(/how can i help/i)
    await userEvent.type(input, 'Fail this stream')
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/partial error answer/i)).toBeInTheDocument()
    expect(await screen.findByText(/stream stopped before it finished/i)).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('starts a blank thread when New is clicked instead of reselecting the previous chat', async () => {
    const savedChat = chat({
      _id: 'local-old',
      title: 'Old thread',
      messages: [
        { id: 'user-old', role: 'user', content: 'Message from the previous thread' },
        { id: 'assistant-old', role: 'assistant', content: 'Previous answer' },
      ],
    })
    storeActiveChat(savedChat)
    mockBaseRequests([savedChat])

    render(<Insights />)

    expect(await screen.findByText('Message from the previous thread')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^new$/i }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/write a message/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText('Ask your business data')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/how can i help/i)).toBeInTheDocument()
  })

  it('deletes chats through an in-app dialog and clears the active conversation', async () => {
    const savedChat = chat({
      _id: 'chat-delete',
      title: 'what are my best sellers??',
      messages: [
        { id: 'user-delete', role: 'user', content: 'Delete this active conversation' },
        { id: 'assistant-delete', role: 'assistant', content: 'It is safe to remove.' },
      ],
    })
    storeActiveChat(savedChat)
    mockBaseRequests([savedChat])
    mockDelete.mockResolvedValue({ data: { success: true } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<Insights />)

    expect(await screen.findByText('Delete this active conversation')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /delete chat/i }))

    const dialog = screen.getByRole('dialog', { name: /delete chat/i })
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/this cannot be undone/i)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/insight-chats/chat-delete')
      expect(screen.queryByText('Delete this active conversation')).not.toBeInTheDocument()
    })
    expect(screen.getByText(/deleted "what are my best sellers\?\?"/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('renames chats through the in-app dialog', async () => {
    const savedChat = chat({ _id: 'chat-rename', title: 'Untitled history' })
    mockBaseRequests([savedChat])
    mockPatch.mockResolvedValue({
      data: {
        chat: {
          ...savedChat,
          title: 'Best sellers review',
          updatedAt: '2026-05-02T10:00:00.000Z',
        },
      },
    })

    render(<Insights />)

    expect(await screen.findByText('Untitled history')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /rename chat/i }))

    const dialog = screen.getByRole('dialog', { name: /rename chat/i })
    const input = within(dialog).getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Best sellers review')
    await userEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/insight-chats/chat-rename', { title: 'Best sellers review' })
      expect(screen.getByText('Best sellers review')).toBeInTheDocument()
    })
  })
})
