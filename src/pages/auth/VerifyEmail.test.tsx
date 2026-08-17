import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import VerifyEmail from './VerifyEmail'

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const token = 'b'.repeat(43)

// StrictMode is what the app actually renders under, and it double-invokes
// effects. This page both reads a one-shot token from the URL fragment and
// spends it, so the second invocation is exactly where it used to break.
function renderPage() {
  return render(
    <StrictMode>
      <BrowserRouter>
        <VerifyEmail />
      </BrowserRouter>
    </StrictMode>
  )
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', `/verify-email#token=${token}`)
    mockPost.mockResolvedValue({ data: { message: 'Email verified. You can now sign in.' } })
  })

  it('verifies a valid link and reports success', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Email verified')).toBeInTheDocument())
    expect(screen.getByText('Email verified. You can now sign in.')).toBeInTheDocument()
    expect(mockPost).toHaveBeenCalledWith('/auth/verify-email', { token })
  })

  it('spends the token exactly once even though the effect runs twice', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Email verified')).toBeInTheDocument())
    // A second request would 404 against a token the first call already redeemed.
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('does not report failure after the fragment has been stripped', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Email verified')).toBeInTheDocument())
    expect(window.location.hash).toBe('')
    expect(screen.queryByText('Verification failed')).not.toBeInTheDocument()
    expect(
      screen.queryByText('This verification link is invalid or incomplete.')
    ).not.toBeInTheDocument()
  })

  it('reports a link with no token as incomplete', async () => {
    window.history.replaceState(null, '', '/verify-email')
    renderPage()

    await waitFor(() => expect(screen.getByText('Verification failed')).toBeInTheDocument())
    expect(
      screen.getByText('This verification link is invalid or incomplete.')
    ).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('surfaces the server message when the token is expired', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'This verification link is invalid or has expired.' } },
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Verification failed')).toBeInTheDocument())
    expect(
      screen.getByText('This verification link is invalid or has expired.')
    ).toBeInTheDocument()
  })
})
