import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import userEvent from '@testing-library/user-event'
import Settings from './Settings'
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

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders cafe details form', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({
          data: {
            success: true,
            cafe: { name: 'Blouberg Coffee', location: { address: '123 Main St', city: 'Cape Town' } },
          },
        })
      }
      if (url.includes('/events')) {
        return Promise.resolve({ data: { events: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Settings />)

    await waitFor(() => {
      expect(screen.getByText('Cafe Details')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Blouberg Coffee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cape Town')).toBeInTheDocument()
  })

  it('shows events list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({
          data: { success: true, cafe: { name: 'Test Cafe', location: { address: '', city: 'Cape Town' } } },
        })
      }
      if (url.includes('/events')) {
        return Promise.resolve({
          data: {
            events: [
              { _id: 'e1', name: 'Blouberg Market', date: '2026-04-05', impact: 'high', recurring: false },
              { _id: 'e2', name: 'Jazz Festival', date: '2026-04-10', impact: 'medium', recurring: false },
            ],
          },
        })
      }
      return Promise.resolve({ data: {} })
    })

    renderWithAuth(<Settings />)

    await waitFor(() => {
      expect(screen.getByText('Blouberg Market')).toBeInTheDocument()
    })

    expect(screen.getByText('Jazz Festival')).toBeInTheDocument()
  })

  it('handles cafe name update', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({
          data: { success: true, cafe: { name: 'Old Name', location: { address: '', city: 'Cape Town' } } },
        })
      }
      if (url.includes('/events')) {
        return Promise.resolve({ data: { events: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    mockPut.mockResolvedValueOnce({ data: { success: true } })

    renderWithAuth(<Settings />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Old Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Old Name')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'New Name')

    await userEvent.click(screen.getByText('Save Cafe Details'))

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/cafe/me', expect.objectContaining({
        name: 'New Name',
      }))
    })
  })
})
