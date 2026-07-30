import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Improvements from './Improvements'
import type { Improvement } from '@/types'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      patch: (...args: unknown[]) => mockPatch(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

const ownerUser = {
  id: 'user123',
  email: 'owner@test.com',
  name: 'Owner',
  role: 'owner' as const,
  orgId: 'org123',
  cafeIds: ['cafe123'],
  activeCafeId: 'cafe123',
}

const sampleTicket: Improvement = {
  _id: 'imp1',
  ticketNumber: 1,
  type: 'fix',
  title: 'Forecast chart cuts off on mobile',
  area: 'planning',
  priority: 'high',
  description: 'The weekly forecast chart overflows its card on narrow screens.',
  desiredOutcome: 'Chart fits within the card at 320px.',
  status: 'open',
  createdBy: { name: 'Jordan', email: 'jordan@test.com' },
  orgId: 'org123',
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
}

const emptyCounts = { all: 0, open: 0, planned: 0, in_progress: 0, done: 0, declined: 0 }

// Builds a mock api.get that serves improvements + benign defaults. When
// `asOwner` is set, /auth/me returns an owner so triage controls render.
function mockApiGet(improvements: Improvement[], asOwner = false) {
  return (url: string) => {
    if (url.includes('/auth/me')) {
      return asOwner ? Promise.resolve({ data: ownerUser }) : Promise.reject(new Error('no session'))
    }
    if (url.includes('/improvements')) {
      const all = improvements.length
      return Promise.resolve({
        data: { improvements, counts: { ...emptyCounts, all, open: all } },
      })
    }
    if (url.includes('/cafe/me')) {
      return Promise.resolve({ data: { cafe: { name: 'Test' } } })
    }
    return Promise.resolve({ data: {} })
  }
}

describe('Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the list of tickets', async () => {
    mockGet.mockImplementation(mockApiGet([sampleTicket]))

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText('Forecast chart cuts off on mobile')).toBeInTheDocument()
    })

    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Desired outcome')).toBeInTheDocument()
    expect(screen.getByText('Jordan')).toBeInTheDocument()
  })

  it('shows the empty state and reveals the log form', async () => {
    mockGet.mockImplementation(mockApiGet([]))

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText('No improvements logged yet')).toBeInTheDocument()
    })

    const logButton = screen.getAllByRole('button', { name: /log an improvement/i })[0]
    await userEvent.click(logButton)

    expect(screen.getByLabelText('Title *')).toBeInTheDocument()
    expect(screen.getByText('Area of the app')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('submits a new ticket and shows a confirmation toast', async () => {
    mockGet.mockImplementation(mockApiGet([]))
    mockPost.mockResolvedValue({ data: { improvement: { ...sampleTicket, ticketNumber: 7 } } })

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText('No improvements logged yet')).toBeInTheDocument()
    })

    await userEvent.click(screen.getAllByRole('button', { name: /log an improvement/i })[0])

    await userEvent.type(screen.getByLabelText('Title *'), 'Add a dark mode toggle')
    await userEvent.type(screen.getByLabelText(/What's the idea/i), 'Let users switch themes.')

    await userEvent.click(screen.getByRole('button', { name: /log it/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/improvements',
        expect.objectContaining({
          title: 'Add a dark mode toggle',
          description: 'Let users switch themes.',
          type: 'improvement',
          pageUrl: '/',
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/Logged as #7/i)).toBeInTheDocument()
    })
  })

  it('lets an owner change a ticket status', async () => {
    mockGet.mockImplementation(mockApiGet([sampleTicket], true))
    mockPatch.mockResolvedValue({ data: { improvement: { ...sampleTicket, status: 'in_progress' } } })

    render(<Improvements />)

    const statusSelect = await screen.findByLabelText(/Status for ticket 1/i)
    const improvementsCallsBefore = mockGet.mock.calls.filter((c) =>
      String(c[0]).includes('/improvements')
    ).length

    await userEvent.selectOptions(statusSelect, 'in_progress')

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/improvements/imp1/status', { status: 'in_progress' })
    })

    // The board refetches after a status change
    await waitFor(() => {
      const after = mockGet.mock.calls.filter((c) => String(c[0]).includes('/improvements')).length
      expect(after).toBeGreaterThan(improvementsCallsBefore)
    })
  })

  it('hides triage controls for non-owners', async () => {
    mockGet.mockImplementation(mockApiGet([sampleTicket]))

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText('Forecast chart cuts off on mobile')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText(/Status for ticket 1/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Delete ticket 1/i)).not.toBeInTheDocument()
  })

  it('lets an owner delete after an inline confirm', async () => {
    mockGet.mockImplementation(mockApiGet([sampleTicket], true))
    mockDelete.mockResolvedValue({ data: { success: true } })

    render(<Improvements />)

    const deleteBtn = await screen.findByLabelText(/Delete ticket 1/i)
    await userEvent.click(deleteBtn)

    // Inline confirm appears; "No" cancels without deleting
    expect(screen.getByText('Delete?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^no$/i }))
    expect(mockDelete).not.toHaveBeenCalled()

    // Re-open and confirm with "Yes"
    await userEvent.click(await screen.findByLabelText(/Delete ticket 1/i))
    await userEvent.click(screen.getByRole('button', { name: /^yes$/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/improvements/imp1')
    })
  })

  it('shows an error state with retry when the initial load fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.reject(new Error('no session'))
      if (url.includes('/improvements')) return Promise.reject(new Error('boom'))
      if (url.includes('/cafe/me')) return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      return Promise.resolve({ data: {} })
    })

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load improvements/i)).toBeInTheDocument()
    })
    // It must NOT masquerade as the empty state
    expect(screen.queryByText(/No improvements logged yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('loads more when there are more tickets than the first page', async () => {
    const second: Improvement = { ...sampleTicket, _id: 'imp2', ticketNumber: 2, title: 'Second ticket' }
    mockGet.mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url.includes('/auth/me')) return Promise.reject(new Error('no session'))
      if (url.includes('/cafe/me')) return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      if (url.includes('/improvements')) {
        const page = config?.params?.page ?? 1
        const improvements = page === 1 ? [sampleTicket] : [second]
        return Promise.resolve({
          data: {
            improvements,
            counts: { ...emptyCounts, all: 2, open: 2 },
            pagination: { total: 2, page, limit: 1, pages: 2 },
          },
        })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Improvements />)

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() => {
      expect(screen.getByText('Second ticket')).toBeInTheDocument()
    })
    // Both tickets now visible (appended)
    expect(screen.getByText('Forecast chart cuts off on mobile')).toBeInTheDocument()
  })
})
