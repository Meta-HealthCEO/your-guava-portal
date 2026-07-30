import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { StrictMode } from 'react'
import AcceptInvite from './AcceptInvite'

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const token = 'a'.repeat(43)

function renderPage() {
  return render(
    <StrictMode>
      <BrowserRouter>
        <AcceptInvite />
      </BrowserRouter>
    </StrictMode>
  )
}

describe('AcceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', `/accept-invite#token=${token}`)
    mockPost.mockImplementation((url: string) => {
      if (url === '/team/invitations/preview') {
        return Promise.resolve({
          data: {
            invitation: {
              email: 'manager@example.com',
              name: 'New Manager',
              organizationName: 'Guava Coffee',
              cafeNames: ['Central Cafe'],
              expiresAt: '2026-08-01T12:00:00.000Z',
            },
          },
        })
      }
      if (url === '/team/invitations/accept') return Promise.resolve({ data: { success: true } })
      return Promise.reject(new Error(`Unexpected POST ${url}`))
    })
  })

  it('scrubs the fragment, previews the invite, and submits the chosen password', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(window.location.hash).toBe('')
    expect(await screen.findByText('Welcome, New Manager')).toBeInTheDocument()
    expect(screen.getByText(/Guava Coffee/)).toBeInTheDocument()
    expect(mockPost).toHaveBeenCalledWith(
      '/team/invitations/preview',
      { token },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )

    await user.type(screen.getByLabelText('Choose a password'), 'secure-password-123')
    await user.type(screen.getByLabelText('Confirm password'), 'secure-password-123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/team/invitations/accept', {
        token,
        password: 'secure-password-123',
      })
    })
    expect(await screen.findByText('Your account is ready')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('does not call the API when the fragment does not contain a valid token', async () => {
    window.history.replaceState(null, '', '/accept-invite#token=short')
    renderPage()

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('blocks mismatched passwords before acceptance', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Welcome, New Manager')

    await user.type(screen.getByLabelText('Choose a password'), 'secure-password-123')
    await user.type(screen.getByLabelText('Confirm password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText(/confirmation do not match/i)).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalledWith('/team/invitations/accept', expect.anything())
  })
})
