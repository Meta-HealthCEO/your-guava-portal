import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Signup from './Signup'
import api from '@/lib/api'

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

const mockRegister = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    isLoading: false,
  }),
}))

const completeSignupForm = async (email = 'jane@cafe.co.za') => {
  await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith')
  await userEvent.type(screen.getByLabelText(/email address/i), email)
  await userEvent.type(screen.getByLabelText(/^password$/i), 'supersecret123')
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret123')
  await userEvent.type(screen.getByLabelText(/cafe name/i), 'The Daily Grind')
}

describe('Signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('submits the form and calls register with correct arguments', async () => {
    mockRegister.mockResolvedValueOnce({
      email: 'jane@cafe.co.za',
      message: 'Check your email.',
    })

    render(<Signup />)

    await completeSignupForm()
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

    expect(screen.getByText(/verify your email/i)).toBeInTheDocument()
    expect(screen.getByText('jane@cafe.co.za')).toBeInTheDocument()
  }, 10000)

  it('does not submit when password confirmation differs', async () => {
    render(<Signup />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@cafe.co.za')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'supersecret123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different123')
    await userEvent.type(screen.getByLabelText(/cafe name/i), 'The Daily Grind')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it.each([
    [
      'VERIFICATION_EMAIL_FAILED',
      'Your registration is saved, but the verification email could not be sent.',
    ],
    [
      'REGISTRATION_PENDING',
      'Registration is already pending for this email.',
    ],
  ])('offers verification resend when registration returns %s', async (code, message) => {
    mockRegister.mockRejectedValueOnce({
      response: {
        data: {
          code,
          message,
        },
      },
    })
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } })

    render(<Signup />)
    await completeSignupForm('Pending@Cafe.co.za')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByText('pending@cafe.co.za')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {
      name: /resend verification email/i,
    }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/resend-verification', {
        email: 'pending@cafe.co.za',
      })
    })
  })

  it('uses the pending email from a nested registration response when supplied', async () => {
    mockRegister.mockRejectedValueOnce({
      response: {
        data: {
          data: {
            code: 'REGISTRATION_PENDING',
            email: 'canonical@example.com',
            message: 'Registration is pending.',
          },
        },
      },
    })

    render(<Signup />)
    await completeSignupForm('typed@example.com')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('canonical@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: /resend verification email/i,
    })).toBeInTheDocument()
  })
})
