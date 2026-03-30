import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Insights from './Insights'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock the api module
const mockGet = vi.fn()
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

describe('Insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders insight cards', async () => {
    // Simulate API failure so component falls back to mock insights
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('No key'))
    })

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText(/flat white sales spike/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/croissant sales dropped/i)).toBeInTheDocument()
    expect(screen.getByText(/morning rush generates/i)).toBeInTheDocument()
    expect(screen.getByText(/cold brew sales are trending/i)).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<Insights />)

    const skeletons = document.querySelectorAll('[class*="skeleton-shimmer"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows refresh button', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('No key'))
    })

    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('shows category badges on insights', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('No key'))
    })

    render(<Insights />)

    await waitFor(() => {
      // The mock insights have exactly these category labels
      expect(screen.getAllByText('Trend').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByText('Watch')).toBeInTheDocument()
    expect(screen.getByText('Tip')).toBeInTheDocument()
    expect(screen.getByText('Highlight')).toBeInTheDocument()
  })
})
