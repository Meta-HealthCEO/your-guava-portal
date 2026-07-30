import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@/test/test-utils'
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
  ReferenceLine: () => null,
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
      if (url.includes('/forecasts/recent')) {
        return Promise.resolve({ data: { forecasts: [] } })
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
      if (url.includes('/forecasts/recent')) {
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

  it('shows an error instead of an empty-data prompt when the week request fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) return Promise.reject(new Error('service unavailable'))
      if (url.includes('/forecasts/recent')) return Promise.resolve({ data: { forecasts: [] } })
      if (url.includes('/forecasts/accuracy')) return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByText(/No forecast data yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('warns when the API returns only part of the seven-day plan', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: twoForecasts,
            meta: {
              expectedDays: 7,
              generatedDays: 2,
              failedDays: [{ dateKey: '2026-03-30', message: 'weather timeout' }],
              isPartial: true,
              insufficientData: false,
              insufficientDays: [],
            },
          },
        })
      }
      if (url.includes('/forecasts/recent')) return Promise.resolve({ data: { forecasts: [] } })
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/2 of 7 forecast days/i)
  })

  it('shows a generation failure instead of an insufficient-data prompt when every day fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: [],
            meta: {
              expectedDays: 7,
              generatedDays: 0,
              failedDays: [{ dateKey: '2026-03-30', message: 'provider timeout' }],
              isPartial: true,
              insufficientData: false,
              insufficientDays: [],
            },
          },
        })
      }
      if (url.includes('/forecasts/recent')) return Promise.resolve({ data: { forecasts: [] } })
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no forecast days could be generated/i)
    expect(screen.queryByText(/not enough matching sales history/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('does not render zero-value plan cards when every day has insufficient history', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: twoForecasts.map((forecast) => ({
              ...forecast,
              availability: {
                status: 'insufficient_data',
                reason: 'At least 3 weeks required',
              },
              items: [],
              totalPredictedRevenue: 0,
            })),
            meta: {
              expectedDays: 7,
              generatedDays: 2,
              failedDays: [],
              isPartial: true,
              insufficientData: true,
              insufficientDays: ['2026-03-28', '2026-03-29'],
            },
          },
        })
      }
      if (url.includes('/forecasts/recent')) return Promise.resolve({ data: { forecasts: [] } })
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    expect(await screen.findByText(/not enough matching sales history/i)).toBeInTheDocument()
    expect(screen.queryByText('Weekly predicted revenue')).not.toBeInTheDocument()
  })

  it('renders a fully closed week instead of replacing it with insufficient-data guidance', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: twoForecasts.map((forecast) => ({
              ...forecast,
              availability: {
                status: 'closed' as const,
                reason: 'Cafe is closed in its trading hours',
              },
              items: [],
              totalPredictedRevenue: 0,
            })),
            meta: {
              expectedDays: 7,
              generatedDays: 2,
              failedDays: [],
              isPartial: false,
              insufficientData: false,
              insufficientDays: [],
            },
          },
        })
      }
      if (url.includes('/forecasts/recent')) return Promise.resolve({ data: { forecasts: [] } })
      if (url.includes('/forecasts/accuracy')) {
        return Promise.resolve({ data: { avgAccuracy: null, forecasts: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Forecasts />)

    expect((await screen.findAllByText('Closed')).length).toBe(2)
    expect(screen.getAllByText('Cafe is closed in its trading hours')).toHaveLength(2)
    expect(screen.getByText('Weekly predicted revenue')).toBeInTheDocument()
    expect(screen.queryByText(/not enough matching sales history/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /open forecast details/i })[0])
    const drawer = screen.getByRole('dialog', { name: /closed day/i })
    expect(within(drawer).getByText('No trading forecast')).toBeInTheDocument()
    expect(within(drawer).getByText('Cafe is closed in its trading hours')).toBeInTheDocument()
    expect(within(drawer).queryByText('Predicted revenue')).not.toBeInTheDocument()
  })
})
