import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Dashboard from './Dashboard'
import { mockForecast, mockStats } from '@/test/mocks/api'

// Mock the logo asset
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

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders loading skeleton initially', () => {
    // Hang forever to keep loading state
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<Dashboard />)
    // Skeleton elements use animate-[skeleton-shimmer...] class
    const skeletons = document.querySelectorAll('[class*="skeleton-shimmer"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows KPI cards with forecast data after load', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/tomorrow')) {
        return Promise.resolve({ data: { forecast: mockForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [mockForecast] } })
      }
      if (url.includes('/transactions/stats')) {
        return Promise.resolve({ data: { stats: mockStats } })
      }
      // Sidebar calls
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Forecast Revenue')).toBeInTheDocument()
    })

    // formatZAR: R20,100 -- use a flexible matcher
    expect(screen.getByText((text) => text.includes('20') && text.includes('100') && text.startsWith('R'))).toBeInTheDocument()
    // Should show top item
    expect(screen.getByText('Top Item')).toBeInTheDocument()
  })

  it('shows empty state when no data uploaded', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    })

    expect(screen.getByText(/upload your yoco transaction data/i)).toBeInTheDocument()
  })

  it('renders day selector with correct days', async () => {
    const weekForecasts = [
      { ...mockForecast, _id: 'f1', date: '2026-03-28' },
      { ...mockForecast, _id: 'f2', date: '2026-03-29' },
      { ...mockForecast, _id: 'f3', date: '2026-03-30' },
    ]

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/tomorrow')) {
        return Promise.resolve({ data: { forecast: mockForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: weekForecasts } })
      }
      if (url.includes('/transactions/stats')) {
        return Promise.resolve({ data: { stats: mockStats } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Forecast Revenue')).toBeInTheDocument()
    })

    // Check that at least 3 day selector buttons appear
    const dayButtons = document.querySelectorAll('button')
    expect(dayButtons.length).toBeGreaterThan(2)
  })

  it('shows weather card with temperature', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/tomorrow')) {
        return Promise.resolve({ data: { forecast: mockForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [mockForecast] } })
      }
      if (url.includes('/transactions/stats')) {
        return Promise.resolve({ data: { stats: mockStats } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    await waitFor(() => {
      // Weather card should show temp -- multiple elements may contain "24"
      const tempElements = screen.getAllByText((text) => text.includes('24') && text.includes('°'))
      expect(tempElements.length).toBeGreaterThan(0)
    })

    expect(screen.getByText('Sunny')).toBeInTheDocument()
    expect(screen.getByText('60% humidity')).toBeInTheDocument()
  })
})
