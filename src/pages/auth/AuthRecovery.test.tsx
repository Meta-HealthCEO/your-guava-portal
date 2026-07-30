import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import VerifyEmail from './VerifyEmail'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}))

describe('auth recovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('verifies the fragment token and scrubs it from browser history', async () => {
    window.history.replaceState({}, '', '/verify-email#token=verification-secret')
    mockPost.mockResolvedValueOnce({
      data: { message: 'Email verified. You can now sign in.' },
    })
    render(<VerifyEmail />)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/verify-email', {
        token: 'verification-secret',
      })
    })
    expect(window.location.hash).toBe('')
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('submits forgot password without revealing account existence', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    render(<ForgotPassword />)
    await userEvent.type(screen.getByLabelText(/email address/i), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'owner@example.com',
      })
    })
    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('confirms and resets a password using a scrubbed fragment token', async () => {
    window.history.replaceState({}, '', '/reset-password#token=reset-secret')
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    render(<ResetPassword />)
    expect(window.location.hash).toBe('')

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'newpassword456')
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      'newpassword456'
    )
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-secret',
        password: 'newpassword456',
      })
    })
    expect(screen.getByText(/password has been reset/i)).toBeInTheDocument()
  })
})
