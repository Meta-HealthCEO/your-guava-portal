import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import Roster from './Roster'

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

// Helper to get the current Monday as YYYY-MM-DD
function getCurrentMonday() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

describe('Roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders 7-column weekly grid', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { shifts: [], staff: [], summaries: [] } })
    })

    render(<Roster />)

    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument()
    })

    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('shows week navigation', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { shifts: [], staff: [], summaries: [] } })
    })

    render(<Roster />)

    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeInTheDocument()
    })

    const navButtons = screen.getAllByRole('button')
    expect(navButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('shows shift cards with staff name and time', async () => {
    const mondayStr = getCurrentMonday()

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/shifts?')) {
        return Promise.resolve({
          data: {
            shifts: [
              {
                _id: 'shift1',
                staffId: { _id: 'staff1', name: 'Sarah' },
                cafeId: 'cafe1',
                date: mondayStr,
                startTime: '08:00',
                endTime: '16:00',
                hoursWorked: 8,
                type: 'regular',
                status: 'scheduled',
              },
            ],
          },
        })
      }
      if (url.includes('/staff')) {
        return Promise.resolve({
          data: {
            staff: [
              { _id: 'staff1', name: 'Sarah', role: 'barista', hourlyRate: 45, startDate: '2025-01-01', isActive: true },
            ],
          },
        })
      }
      if (url.includes('/shifts/summary')) {
        return Promise.resolve({ data: { summaries: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Roster />)

    await waitFor(() => {
      // Sarah appears in shift card AND in sidebar staff list
      expect(screen.getAllByText('Sarah').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByText(/08:00 — 16:00/)).toBeInTheDocument()
  })

  it('shows overtime warning badge', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/shifts?')) {
        return Promise.resolve({ data: { shifts: [] } })
      }
      if (url.includes('/staff')) {
        return Promise.resolve({
          data: {
            staff: [
              { _id: 'staff1', name: 'Sarah', role: 'barista', hourlyRate: 45, startDate: '2025-01-01', isActive: true },
            ],
          },
        })
      }
      if (url.includes('/shifts/summary')) {
        return Promise.resolve({
          data: {
            summaries: [
              { staffId: 'staff1', staffName: 'Sarah', totalHours: 50, regularHours: 45, overtimeHours: 5, estimatedPay: 2475 },
            ],
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Roster />)

    await waitFor(() => {
      expect(screen.getByText('OT')).toBeInTheDocument()
    })
  })
})
