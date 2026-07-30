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
      if (url.includes('/forecasts/today')) {
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
    expect(screen.getByText(/factor detail is unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText('Time-of-Day Breakdown')).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalledWith('/forecasts/tomorrow')
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

    expect(screen.getByText(/upload your transaction data/i)).toBeInTheDocument()
  })

  it('renders day selector with correct days', async () => {
    const weekForecasts = [
      { ...mockForecast, _id: 'f1', date: '2026-03-28' },
      { ...mockForecast, _id: 'f2', date: '2026-03-29' },
      { ...mockForecast, _id: 'f3', date: '2026-03-30' },
    ]

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) {
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

  it('uses the selected week forecast instead of briefly swapping from the today fallback', async () => {
    const todayFallbackForecast = {
      ...mockForecast,
      _id: 'today-fallback',
      date: '2026-03-28',
      signals: {
        ...mockForecast.signals,
        weather: { temp: 31, condition: 'Rain', humidity: 80 },
      },
    }
    const selectedWeekForecast = {
      ...mockForecast,
      _id: 'today',
      date: '2026-03-28',
      signals: {
        ...mockForecast.signals,
        weather: { temp: 18, condition: 'Cloudy', humidity: 55 },
      },
    }

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) {
        return Promise.resolve({ data: { forecast: todayFallbackForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [selectedWeekForecast] } })
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
      expect(screen.getByText('Cloudy')).toBeInTheDocument()
    })

    expect(screen.queryByText('Rain')).not.toBeInTheDocument()
  })

  it('uses the today forecast as fallback when week forecasts fail', async () => {
    const todayForecast = {
      ...mockForecast,
      _id: 'today-only',
      signals: {
        ...mockForecast.signals,
        weather: { temp: 21, condition: 'Partly cloudy', humidity: 58 },
      },
    }

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) {
        return Promise.resolve({ data: { forecast: todayForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.reject(new Error('week failed'))
      }
      if (url.includes('/transactions/stats')) {
        return Promise.resolve({ data: { stats: mockStats } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test', location: { city: 'Cape Town' } } } })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Partly cloudy')).toBeInTheDocument()
    })

    expect(screen.queryByText('Forecast unavailable')).not.toBeInTheDocument()
  })

  it('shows a forecast unavailable state when sales exist but forecast calls fail', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today') || url.includes('/forecasts/week')) {
        return Promise.reject(new Error('forecast failed'))
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
      expect(screen.getByText('Forecast unavailable')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows a clear no-predictions state when a forecast has no items', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) {
        return Promise.resolve({ data: { forecast: { ...mockForecast, items: [] } } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [] } })
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
      expect(screen.getByText('No item predictions for this day')).toBeInTheDocument()
    })

    expect(screen.queryByText('Time-of-Day Breakdown')).not.toBeInTheDocument()
  })

  it('shows weather card with temperature', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) {
        return Promise.resolve({ data: { forecast: mockForecast } })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({ data: { forecasts: [mockForecast] } })
      }
      if (url.includes('/transactions/stats')) {
        return Promise.resolve({ data: { stats: mockStats } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test', location: { address: '123 Test St', city: 'Cape Town' } } } })
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
    expect(screen.getByText('123 Test St, Cape Town')).toBeInTheDocument()
  })

  it('shows honest unavailable states instead of fabricated weather or stage zero', async () => {
    const unavailableForecast = {
      ...mockForecast,
      signals: {
        ...mockForecast.signals,
        weather: {
          available: false,
          condition: 'Unavailable',
          unavailableReason: 'Cafe coordinates are not configured',
        },
        loadSheddingStage: null,
        loadSheddingAvailable: false,
        loadSheddingUnavailableReason: 'Provider unavailable',
      },
    }
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/today')) return Promise.resolve({ data: { forecast: unavailableForecast } })
      if (url.includes('/forecasts/week')) return Promise.resolve({ data: { forecasts: [unavailableForecast] } })
      if (url.includes('/transactions/stats')) return Promise.resolve({ data: { stats: mockStats } })
      if (url.includes('/cafe/me')) return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    expect(await screen.findByText('Weather unavailable')).toBeInTheDocument()
    expect(screen.getByText('Cafe coordinates are not configured')).toBeInTheDocument()
    expect(screen.getByText('Load shedding unavailable')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('undefined°')
    expect(document.body.textContent).not.toContain('undefined%')
  })

  it('does not misreport an API failure as an empty account', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/forecasts/week')) return Promise.reject(new Error('forecast service offline'))
      if (url.includes('/forecasts/today')) return Promise.reject(new Error('forecast service offline'))
      if (url.includes('/transactions/stats')) return Promise.reject(new Error('stats service offline'))
      if (url.includes('/cafe/me')) return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<Dashboard />)

    expect(await screen.findByText('Dashboard data unavailable')).toBeInTheDocument()
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
