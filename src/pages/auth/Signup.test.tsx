import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Signup from './Signup'

// Mock the logo asset
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

// Mock the api module
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: vi.fn(),
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockRegister = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    isLoading: false,
  }),
}))

describe('Signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('submits the form and calls register with correct arguments', async () => {
    mockRegister.mockResolvedValueOnce(undefined)

    render(<Signup />)

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@cafe.co.za')
    await userEvent.type(screen.getByLabelText(/password/i), 'supersecret123')
    await userEvent.type(screen.getByLabelText(/cafe name/i), 'The Daily Grind')
    // Leave organization name empty — should pass undefined

    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'jane@cafe.co.za',
        'supersecret123',
        'Jane Smith',
        'The Daily Grind',
        undefined
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
