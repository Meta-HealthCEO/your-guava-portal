import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import ResetPassword from './ResetPassword'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const token = 'r'.repeat(43)

// main.tsx wraps the whole app in StrictMode, which deliberately double-invokes
// state initializers and effects. This page reads a one-shot token out of the
// URL fragment and strips the fragment in the same breath, so the second
// invocation is exactly where it broke: it found nothing and declared a
// perfectly good link incomplete.
function renderPage() {
  return render(
    <StrictMode>
      <BrowserRouter>
        <ResetPassword />
      </BrowserRouter>
    </StrictMode>
  )
}

async function fillAndSubmit(password = 'newpassword456') {
  await userEvent.type(await screen.findByLabelText(/^new password$/i), password)
  await userEvent.type(screen.getByLabelText(/confirm new password/i), password)
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }))
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', `/reset-password#token=${token}`)
    mockPost.mockResolvedValue({ data: { success: true } })
  })

  it('captures the fragment token exactly once and scrubs it from history', async () => {
    renderPage()

    await screen.findByLabelText(/^new password$/i)
    expect(window.location.hash).toBe('')
    expect(
      screen.queryByText(/this reset link is invalid or incomplete/i)
    ).not.toBeInTheDocument()
  })

  it('keeps the submit button usable under a double-invoked render', async () => {
    renderPage()

    const submit = await screen.findByRole('button', { name: /reset password/i })
    expect(submit).toBeEnabled()
  })

  // Reading the fragment used to happen inside a useState lazy initializer,
  // which runs in the render phase -- so history was mutated while rendering,
  // and StrictMode ran that mutation twice per mount. React happens to keep the
  // first initializer's result, which is the only reason the page still worked,
  // but a render React discards before commit would spend the token for nothing.
  // Capturing in a ref-guarded layout effect makes it a commit-phase side effect
  // that happens exactly once, the same shape VerifyEmail and AcceptInvite use.
  it('mutates history exactly once, after commit rather than during render', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    renderPage()

    await screen.findByLabelText(/^new password$/i)
    // BrowserRouter stamps its own history index on mount with a two-argument
    // call, so only the three-argument calls that rewrite the URL are the page's.
    const pageRewrites = replaceState.mock.calls.filter((call) => call[2] !== undefined)
    expect(pageRewrites).toHaveLength(1)
    expect(String(pageRewrites[0][2])).not.toContain('#')
    replaceState.mockRestore()
  })

  it('resets the password on the happy path', async () => {
    renderPage()
    await fillAndSubmit()

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
        token,
        password: 'newpassword456',
      })
    })
    expect(await screen.findByText(/password has been reset/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('refuses to submit when the confirmation differs', async () => {
    renderPage()
    await userEvent.type(await screen.findByLabelText(/^new password$/i), 'newpassword456')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'somethingelse9')
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('reports a link with no token as incomplete', async () => {
    window.history.replaceState(null, '', '/reset-password')
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or incomplete/i)
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled()
  })

  it('shows the server message when the token is rejected', async () => {
    mockPost.mockRejectedValue({
      response: { status: 400, data: { message: 'This reset link has already been used.' } },
    })
    renderPage()
    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link has already been used.'
    )
  })

  it('claims expiry only when the server actually rejected the token', async () => {
    mockPost.mockRejectedValue({ response: { status: 404, data: {} } })
    renderPage()
    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i)
  })

  // The token is single-use and lives one hour, and requesting a replacement
  // revokes it. Blaming a good link for a dropped connection sends the user to
  // throw away the only working link they have.
  it('does not blame the link when the request never reached the server', async () => {
    mockPost.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 20000ms exceeded' })
    renderPage()
    await fillAndSubmit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not (be sent|reach)/i)
    expect(alert).toHaveTextContent(/still valid/i)
    expect(alert).not.toHaveTextContent(/expired/i)
  })

  it('lets the same token be retried after a network failure', async () => {
    mockPost.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' })
    renderPage()
    await fillAndSubmit()
    await screen.findByRole('alert')

    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/password has been reset/i)).toBeInTheDocument()
    expect(mockPost).toHaveBeenLastCalledWith('/auth/reset-password', {
      token,
      password: 'newpassword456',
    })
  })

  it('names both fields so password managers save the new credential', async () => {
    renderPage()

    const next = await screen.findByLabelText(/^new password$/i)
    expect(next).toHaveAttribute('name', 'new-password')
    expect(next).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      'name',
      'confirm-new-password'
    )
  })
})
