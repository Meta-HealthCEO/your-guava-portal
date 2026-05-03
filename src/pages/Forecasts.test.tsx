import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Forecasts from './Forecasts'
import { mockForecast } from '@/test/mocks/api'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock recharts to avoid jsdom SVG issues
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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

const twoForecasts = [
  { ...mockForecast, _id: 'f1', date: '2026-03-28', totalPredictedRevenue: 20100 },
  { ...mockForecast, _id: 'f2', date: '2026-03-29', totalPredictedRevenue: 22000 },
]

describe('Forecasts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the analytics view with key header stats', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: twoForecasts } })
      }
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: 85, forecasts: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { data: [] } })
    })

    render(<Forecasts />)

    await waitFor(() => {
      expect(screen.getByText('Weekly predicted revenue')).toBeInTheDocument()
    })

    // Should show 30-day accuracy section
    expect(screen.getByText('30-day accuracy')).toBeInTheDocument()
    // Peak day section
    expect(screen.getByText('Peak day')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    render(<Forecasts />)
    const skeletons = document.querySelectorAll('[class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows summary header text', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    render(<Forecasts />)
    expect(screen.getByText(/7-day rolling sales forecast/i)).toBeInTheDocument()
  })

  it('shows empty state when no forecasts returned', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [] } })
      }
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { data: [] } })
    })

    render(<Forecasts />)

    await waitFor(() => {
      expect(screen.getByText(/No forecast data yet/i)).toBeInTheDocument()
    })
  })
})
