import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import Login from './Login'

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

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders login form with email and password fields', () => {
    render(<Login />)
    expect(screen.getByPlaceholderText(/owner@yourcafe/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument()
  })

  it('displays the Your Guava logo', () => {
    render(<Login />)
    const logos = screen.getAllByAltText('Your Guava')
    expect(logos.length).toBeGreaterThan(0)
  })

  it('renders welcome text', () => {
    render(<Login />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your portal')).toBeInTheDocument()
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
})
