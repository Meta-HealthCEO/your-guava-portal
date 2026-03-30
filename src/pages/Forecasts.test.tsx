import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Forecasts from './Forecasts'
import { mockForecast } from '@/test/mocks/api'

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

describe('Forecasts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders forecast cards', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: [
              { ...mockForecast, _id: 'f1', date: '2026-03-28' },
              { ...mockForecast, _id: 'f2', date: '2026-03-29', totalPredictedRevenue: 22000 },
            ],
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeInTheDocument()
    })

    // Should show revenue for the forecasts -- use flexible matchers
    expect(screen.getByText((text) => text.includes('20') && text.includes('100'))).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('22') && text.includes('000'))).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<Forecasts />)

    const skeletons = document.querySelectorAll('[class*="skeleton-shimmer"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows summary header', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<Forecasts />)

    expect(screen.getByText(/7-day rolling sales forecast/i)).toBeInTheDocument()
  })
})
