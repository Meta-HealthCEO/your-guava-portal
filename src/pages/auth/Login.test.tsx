import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Login from './Login'
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

const mockNavigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.get).mockRejectedValue(new Error('No refresh session'))
  })

  it('renders login form with email and password fields', async () => {
    render(<Login />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'))
    expect(screen.getByPlaceholderText(/owner@yourcafe/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument()
  })

  it('displays the Your Guava logo', async () => {
    render(<Login />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'))
    const logos = screen.getAllByAltText('Your Guava')
    expect(logos.length).toBeGreaterThan(0)
  })

  it('renders welcome text', async () => {
    render(<Login />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'))
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your portal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  it('shows error on invalid credentials', async () => {
    const { default: api } = await import('@/lib/api')
    const mockPost = vi.mocked(api.post)
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    })

    render(<Login />)

    await userEvent.type(screen.getByPlaceholderText(/owner@yourcafe/i), 'bad@email.com')
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows generic error when no response message', async () => {
    const { default: api } = await import('@/lib/api')
    const mockPost = vi.mocked(api.post)
    mockPost.mockRejectedValueOnce(new Error('Network error'))

    render(<Login />)

    await userEvent.type(screen.getByPlaceholderText(/owner@yourcafe/i), 'bad@email.com')
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  it('submit button shows loading state', async () => {
    const { default: api } = await import('@/lib/api')
    const mockPost = vi.mocked(api.post)
    // Make login hang
    mockPost.mockImplementationOnce(() => new Promise(() => {}))

    render(<Login />)

    await userEvent.type(screen.getByPlaceholderText(/owner@yourcafe/i), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })

  it('offers a verification resend when the API requires email verification', async () => {
    const { default: api } = await import('@/lib/api')
    const mockPost = vi.mocked(api.post)
    mockPost
      .mockRejectedValueOnce({
        response: {
          data: {
            code: 'EMAIL_VERIFICATION_REQUIRED',
            message: 'Verify your email address before signing in',
          },
        },
      })
      .mockResolvedValueOnce({ data: { success: true } })

    render(<Login />)
    await userEvent.type(screen.getByLabelText(/email address/i), 'pending@example.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    const resend = await screen.findByRole('button', {
      name: /resend verification email/i,
    })
    await userEvent.click(resend)
    await waitFor(() => {
      expect(mockPost).toHaveBeenLastCalledWith('/auth/resend-verification', {
        email: 'pending@example.com',
      })
    })
  })
})
