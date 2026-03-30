import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Analytics from './Analytics'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
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

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders revenue tab by default', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    render(<Analytics />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Items')).toBeInTheDocument()
    expect(screen.getByText('Heatmap')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
  })

  it('switches between tabs', async () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    render(<Analytics />)

    const itemsTab = screen.getByRole('button', { name: 'Items' })
    await userEvent.click(itemsTab)

    await waitFor(() => {
      expect(itemsTab.className).toContain('text-[#D43D3D]')
    })
  })

  it('shows revenue chart with data', async () => {
    const revenueData = {
      analytics: {
        data: [
          { date: '2026-03-01', revenue: 5000, transactions: 50 },
          { date: '2026-03-02', revenue: 6000, transactions: 60 },
        ],
        totalRevenue: 11000,
        avgDailyRevenue: 5500,
        bestDay: { date: '2026-03-02', revenue: 6000 },
        worstDay: { date: '2026-03-01', revenue: 5000 },
        trend: 5.2,
      },
    }

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: revenueData })
    })

    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Daily Revenue')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    // Verify total revenue is displayed (formatted with locale)
    expect(screen.getByText((text) => text.includes('11') && text.includes('000') && text.startsWith('R'))).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    render(<Analytics />)

    // Should show skeleton loading while waiting (skeleton-shimmer)
    const skeletons = document.querySelectorAll('[class*="skeleton-shimmer"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows item performance table', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/analytics/items')) {
        return Promise.resolve({
          data: {
            items: [
              { name: 'Flat White', totalQty: 200, totalRevenue: 8000, avgPerDay: 10, trend: 5.0 },
              { name: 'Long White', totalQty: 180, totalRevenue: 7200, avgPerDay: 9, trend: -2.0 },
            ],
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Analytics />)

    // Click Items tab
    await userEvent.click(screen.getByRole('button', { name: 'Items' }))

    await waitFor(() => {
      expect(screen.getByText('Item Performance')).toBeInTheDocument()
    })

    expect(screen.getByText('Flat White')).toBeInTheDocument()
    expect(screen.getByText('Long White')).toBeInTheDocument()
  })
})
