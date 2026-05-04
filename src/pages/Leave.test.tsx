import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import userEvent from '@testing-library/user-event'
import Leave from './Leave'
import type { ReactNode } from 'react'

// Mock assets
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

// Mock the api module
const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: vi.fn(),
      put: (...args: unknown[]) => mockPut(...args),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'http://localhost:5000/api' },
    },
  }
})

function renderWithAuth(ui: ReactNode) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test Owner',
    role: 'owner' as const,
    orgId: 'org123',
    cafeIds: ['cafe123'],
    activeCafeId: 'cafe123',
  }

  return render(
    <BrowserRouter>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isOwner: true,
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          switchCafe: vi.fn(),
        }}
      >
        {ui}
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('Leave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders leave request list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/leave/calendar')) {
        return Promise.resolve({ data: { calendar: [] } })
      }
      if (url.includes('/leave/balances')) {
        return Promise.resolve({ data: { balances: [] } })
      }
      if (url.includes('/leave')) {
        return Promise.resolve({
          data: {
            requests: [
              {
                _id: 'lr1',
                staffId: { _id: 'staff1', name: 'Sarah' },
                cafeId: 'cafe1',
                type: 'annual',
                startDate: '2026-04-01',
                endDate: '2026-04-05',
                days: 5,
                status: 'pending',
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
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Leave />)

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument()
    })

    // "5" appears in the days column and possibly in the calendar
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('shows filter tabs (All, Pending, Approved, Rejected)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { requests: [], staff: [], calendar: [] } })
    })

    renderWithAuth(<Leave />)

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('shows approve/reject buttons for pending requests', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/leave/calendar')) {
        return Promise.resolve({ data: { calendar: [] } })
      }
      if (url.includes('/leave')) {
        return Promise.resolve({
          data: {
            requests: [
              {
                _id: 'lr1',
                staffId: { _id: 'staff1', name: 'Sarah' },
                cafeId: 'cafe1',
                type: 'annual',
                startDate: '2026-04-01',
                endDate: '2026-04-05',
                days: 5,
                status: 'pending',
              },
            ],
          },
        })
      }
      if (url.includes('/staff')) {
        return Promise.resolve({ data: { staff: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Leave />)

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument()
    })

    // Approve and reject action buttons
    const approveButtons = document.querySelectorAll('button[class*="text-[#4DA63B]"]')
    const rejectButtons = document.querySelectorAll('button[class*="text-[#D43D3D]"]')
    expect(approveButtons.length).toBeGreaterThanOrEqual(1)
    expect(rejectButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders submit leave form', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { requests: [], staff: [], calendar: [] } })
    })

    renderWithAuth(<Leave />)

    await waitFor(() => {
      expect(screen.getByText('Request Leave')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Request Leave'))

    await waitFor(() => {
      expect(screen.getByText('Submit Leave Request')).toBeInTheDocument()
    })
  })
})
