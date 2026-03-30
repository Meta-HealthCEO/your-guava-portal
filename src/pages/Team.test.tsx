import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import Team from './Team'
import type { ReactNode } from 'react'

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

function renderWithAuth(ui: ReactNode, { role = 'owner' }: { role?: 'owner' | 'manager' } = {}) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test User',
    role,
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
          isOwner: role === 'owner',
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

describe('Team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: sidebar API calls
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({ data: { success: true, cafes: [] } })
      }
      if (url.includes('/team')) {
        return Promise.resolve({ data: { success: true, members: [] } })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it('renders access denied for non-owner', async () => {
    renderWithAuth(<Team />, { role: 'manager' })

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
    })
    expect(screen.getByText(/only account owners/i)).toBeInTheDocument()
  })

  it('renders team member list', async () => {
    const mockMembers = [
      {
        _id: 'u1',
        name: 'Alice Owner',
        email: 'alice@test.com',
        role: 'owner',
        cafeIds: [{ _id: 'c1', name: 'Test Cafe' }],
        createdAt: '2025-01-01',
      },
      {
        _id: 'u2',
        name: 'Bob Manager',
        email: 'bob@test.com',
        role: 'manager',
        cafeIds: [{ _id: 'c1', name: 'Test Cafe' }],
        createdAt: '2025-02-01',
      },
    ]

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/team')) {
        return Promise.resolve({ data: { success: true, members: mockMembers } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({ data: { success: true, cafes: [{ _id: 'c1', name: 'Test Cafe' }] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Team />)

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument()
      expect(screen.getByText('Bob Manager')).toBeInTheDocument()
    })
  })

  it('shows invite form with name, email, password fields', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/team')) {
        return Promise.resolve({ data: { success: true, members: [] } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({ data: { success: true, cafes: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Team />)

    await waitFor(() => {
      // "Invite Manager" appears in both heading and submit button
      expect(screen.getAllByText('Invite Manager').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByPlaceholderText('Manager name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('manager@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Temporary password')).toBeInTheDocument()
  })

  it('shows cafe checkboxes in invite form', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/team')) {
        return Promise.resolve({ data: { success: true, members: [] } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({
          data: { success: true, cafes: [{ _id: 'c1', name: 'Blouberg Coffee' }, { _id: 'c2', name: 'Sea Point Brew' }] },
        })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Team />)

    await waitFor(() => {
      expect(screen.getByText('Blouberg Coffee')).toBeInTheDocument()
      expect(screen.getByText('Sea Point Brew')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(2)
  })

  it('shows remove button for managers, not for owner', async () => {
    const mockMembers = [
      {
        _id: 'u1',
        name: 'Alice Owner',
        email: 'alice@test.com',
        role: 'owner',
        cafeIds: [],
        createdAt: '2025-01-01',
      },
      {
        _id: 'u2',
        name: 'Bob Manager',
        email: 'bob@test.com',
        role: 'manager',
        cafeIds: [],
        createdAt: '2025-02-01',
      },
    ]

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/team')) {
        return Promise.resolve({ data: { success: true, members: mockMembers } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({ data: { success: true, cafes: [] } })
      }
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test' } } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Team />)

    await waitFor(() => {
      expect(screen.getByText('Alice Owner')).toBeInTheDocument()
    })

    // There should be exactly one delete button (for Bob the manager)
    const deleteButtons = document.querySelectorAll('button[class*="hover:text-red-400"]')
    expect(deleteButtons.length).toBe(1)
  })
})
