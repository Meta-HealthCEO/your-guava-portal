import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logo from '@/assets/logo.png'

const INCOMPLETE_LINK_MESSAGE = 'This reset link is invalid or incomplete.'
const REJECTED_LINK_MESSAGE = 'This reset link is invalid or has expired.'
// The token is single-use, lives one hour, and asking for a replacement revokes
// it. Telling someone their link died because their connection dropped sends
// them to throw away the only working link they have.
const UNREACHABLE_MESSAGE =
  'Your password was not changed — the request could not be sent. This link is still valid, so check your connection and try again.'

type RequestFailure = {
  response?: { status?: number; data?: { message?: unknown } }
}

// Only the server can say a token is spent. A request that never got an answer
// says nothing at all about the link.
function resetErrorMessage(error: unknown): string {
  const failure = (error ?? {}) as RequestFailure
  const response = failure.response
  if (!response) return UNREACHABLE_MESSAGE
  const message = response.data?.message
  if (typeof message === 'string' && message.trim()) return message
  const status = response.status
  if (status && status >= 500) return UNREACHABLE_MESSAGE
  return REJECTED_LINK_MESSAGE
}

export default function ResetPassword() {
  // undefined = the fragment has not been read yet, null = no usable token.
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captured = useRef(false)

  // The email link carries the token in the fragment, which is never sent to the
  // hosting server. Capture it before paint, then strip it from history.
  //
  // The ref guard matters: this effect removes the fragment it just read, so a
  // second invocation on the same mount — StrictMode in development, or any
  // remount — would find nothing and mistake a valid link for a malformed one.
  // Reading it during render instead (a useState lazy initializer) made the
  // history mutation a render-phase side effect, which React 19's renderer is
  // free to run and then discard.
  useLayoutEffect(() => {
    if (captured.current) return
    captured.current = true
    const candidate =
      new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')?.trim() || ''
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    )
    setToken(candidate || null)
    if (!candidate) setError(INCOMPLETE_LINK_MESSAGE)
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.post('/auth/reset-password', { token, password })
      setComplete(true)
    } catch (requestError: unknown) {
      setError(resetErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0808] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] p-8">
        <img src={logo} alt="Your Guava" className="mx-auto mb-8 w-36" />
        <h1 className="text-xl font-bold text-text">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Use at least 8 characters. Resetting your password signs out existing sessions.
        </p>

        {complete ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded-lg border border-guava-green/20 bg-guava-green/10 p-4 text-sm text-guava-green" role="status">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Your password has been reset. You can now sign in.
            </div>
            <Link className="mt-6 block text-center text-sm text-guava-green hover:underline" to="/login">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                aria-describedby={error ? 'reset-password-error' : undefined}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                name="confirm-new-password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p id="reset-password-error" className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting || !token}>
              {submitting ? 'Resetting...' : 'Reset password'}
            </Button>
            <Link className="block text-center text-sm text-guava-green hover:underline" to="/login">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
