import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import VerifyEmail from './VerifyEmail'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const token = 'b'.repeat(43)

// StrictMode double-invokes effects; the token is one-shot, so this is where the page used to break.
function renderPage() {
  return render(
    <StrictMode>
      <BrowserRouter>
        <VerifyEmail />
      </BrowserRouter>
    </StrictMode>
  )
}

async function submitPassword(value = 'victim-password-1') {
  await userEvent.type(await screen.findByLabelText(/^password$/i), value)
  await userEvent.click(screen.getByRole('button', { name: /verify and finish/i }))
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', `/verify-email#token=${token}`)
    mockPost.mockResolvedValue({ data: { message: 'Email verified. You can now sign in.' } })
  })

  it('asks for the sign-up password before spending the link', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /finish creating your account/i })).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()

    await submitPassword()

    await waitFor(() => expect(screen.getByText('Email verified')).toBeInTheDocument())
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/auth/verify-email', { token, password: 'victim-password-1' })
  })

  it('strips the token from the address bar before anything is submitted', async () => {
    renderPage()
    await screen.findByLabelText(/^password$/i)
    expect(window.location.hash).toBe('')
  })

  it('keeps the form and says why when the password does not match this sign-up', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          code: 'VERIFICATION_PASSWORD_MISMATCH',
          message: 'That is not the password used for this sign-up. If you did not sign up, you can ignore the email.',
        },
      },
    })
    renderPage()
    await submitPassword('wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent(/not the password used for this sign-up/i)
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.queryByText('Verification failed')).not.toBeInTheDocument()
  })

  it('reports a link with no token as incomplete without asking for a password', async () => {
    window.history.replaceState(null, '', '/verify-email')
    renderPage()
    await waitFor(() => expect(screen.getByText('Verification failed')).toBeInTheDocument())
    expect(screen.getByText('This verification link is invalid or incomplete.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
  })

  it('surfaces the server message when the link is expired or replaced', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 404, data: { message: 'This verification link is invalid or has expired' } },
    })
    renderPage()
    await submitPassword()
    await waitFor(() => expect(screen.getByText('Verification failed')).toBeInTheDocument())
    expect(screen.getByText('This verification link is invalid or has expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up again/i })).toHaveAttribute('href', '/signup')
  })
})
