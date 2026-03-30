import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, AuthContext } from './AuthContext'
import { useContext } from 'react'

// Mock the api module
const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
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

// Test consumer component
function TestConsumer() {
  const ctx = useContext(AuthContext)
  if (!ctx) return <div>No context</div>

  return (
    <div>
      <div data-testid="user">{ctx.user ? ctx.user.name : 'null'}</div>
      <div data-testid="loading">{ctx.isLoading ? 'true' : 'false'}</div>
      <div data-testid="isOwner">{ctx.isOwner ? 'true' : 'false'}</div>
      <button onClick={() => ctx.login('test@test.com', 'pass')}>Login</button>
      <button onClick={() => ctx.logout()}>Logout</button>
      <button onClick={() => ctx.switchCafe('cafe456')}>Switch Cafe</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('provides user as null initially when no token', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  it('sets user after login', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'owner',
      orgId: 'org1',
      cafeIds: ['c1'],
      activeCafeId: 'c1',
    }

    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'token123', user: mockUser },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })

    expect(localStorage.getItem('accessToken')).toBe('token123')
  })

  it('clears user after logout', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'owner',
      orgId: 'org1',
      cafeIds: ['c1'],
      activeCafeId: 'c1',
    }

    mockPost
      .mockResolvedValueOnce({ data: { accessToken: 'token123', user: mockUser } }) // login
      .mockResolvedValueOnce({}) // logout

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Login first
    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })

    // Now logout
    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })

    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('isOwner returns true for owner role', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Owner User',
      role: 'owner',
      orgId: 'org1',
      cafeIds: ['c1'],
      activeCafeId: 'c1',
    }

    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'token123', user: mockUser },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('isOwner')).toHaveTextContent('true')
    })
  })

  it('isOwner returns false for manager role', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Manager User',
      role: 'manager',
      orgId: 'org1',
      cafeIds: ['c1'],
      activeCafeId: 'c1',
    }

    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'token123', user: mockUser },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('isOwner')).toHaveTextContent('false')
    })
  })

  it('switchCafe calls API and reloads', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'owner',
      orgId: 'org1',
      cafeIds: ['c1', 'c2'],
      activeCafeId: 'c1',
    }

    // Mock window.location.reload
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    })

    mockPost
      .mockResolvedValueOnce({ data: { accessToken: 'token123', user: mockUser } }) // login
      .mockResolvedValueOnce({ data: { accessToken: 'newtoken', activeCafeId: 'c2' } }) // switchCafe

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Login first
    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })

    // Switch cafe
    await userEvent.click(screen.getByText('Switch Cafe'))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/team/switch-cafe', { cafeId: 'cafe456' })
    })

    expect(localStorage.getItem('accessToken')).toBe('newtoken')
    expect(reloadMock).toHaveBeenCalled()
  })
})
