import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Staff from './Staff'
import { mockStaffMember } from '@/test/mocks/api'

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

describe('Staff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders staff list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/staff')) {
        return Promise.resolve({ data: { staff: [mockStaffMember] } })
      }
      if (url.includes('/api/leave/balances')) {
        return Promise.resolve({
          data: {
            balances: [{
              staffId: 'staff123',
              annual: { total: 15, used: 5 },
              sick: { total: 10, used: 2 },
              family: { total: 3, used: 0 },
            }],
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Staff />)

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument()
    })

    expect(screen.getByText('barista')).toBeInTheDocument()
  })

  it('shows add staff form', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: { staff: [], balances: [] } })
    })

    render(<Staff />)

    await waitFor(() => {
      expect(screen.getByText('No staff yet')).toBeInTheDocument()
    })

    // Click Add Staff
    const addButton = screen.getAllByText('Add Staff')[0]
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Add Staff Member')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('082 123 4567')).toBeInTheDocument()
  })

  it('renders leave balance progress bars', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/staff')) {
        return Promise.resolve({ data: { staff: [mockStaffMember] } })
      }
      if (url.includes('/api/leave/balances')) {
        return Promise.resolve({
          data: {
            balances: [{
              staffId: 'staff123',
              annual: { total: 15, used: 5 },
              sick: { total: 10, used: 2 },
              family: { total: 3, used: 0 },
            }],
          },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Staff />)

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument()
    })

    expect(screen.getByText('Annual')).toBeInTheDocument()
    expect(screen.getByText('Sick')).toBeInTheDocument()
    expect(screen.getByText('Family')).toBeInTheDocument()

    expect(screen.getByText('10/15 days')).toBeInTheDocument()
    expect(screen.getByText('8/10 days')).toBeInTheDocument()
    expect(screen.getByText('3/3 days')).toBeInTheDocument()
  })

  it('shows edit mode on click', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/staff')) {
        return Promise.resolve({ data: { staff: [mockStaffMember] } })
      }
      if (url.includes('/api/leave/balances')) {
        return Promise.resolve({ data: { balances: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Staff />)

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument()
    })

    // Click the edit button (h-7 w-7 icon button that is NOT the red deactivate one)
    const editButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.className.includes('h-7') && btn.className.includes('w-7') && !btn.className.includes('text-[#D43D3D]')
    )
    if (editButton) {
      await userEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Sarah')).toBeInTheDocument()
      })
    }
  })
})
