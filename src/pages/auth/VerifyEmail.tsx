import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AlertCircle, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logo from '@/assets/logo.png'

type VerifyState = 'reading' | 'form' | 'verifying' | 'verified' | 'error'
type VerifyFailure = { response?: { status?: number; data?: { message?: unknown } } }

const ERROR_ID = 'verify-password-error'

export default function VerifyEmail() {
  const [state, setState] = useState<VerifyState>('reading')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const captured = useRef(false)

  // The token is in the fragment, which never reaches the hosting server. Read it before paint and strip it from history.
  // The ref guard keeps StrictMode's second invocation from mistaking a stripped fragment for a malformed link.
  useLayoutEffect(() => {
    if (captured.current) return
    captured.current = true
    const candidate = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')?.trim() || ''
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    if (candidate) {
      setToken(candidate)
      setState('form')
    } else {
      setState('error')
      setMessage('This verification link is invalid or incomplete.')
    }
  }, [])

  // The server spends the link only when the password matches the sign-up (BE-02-T01), so a wrong password keeps the form.
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || state === 'verifying') return
    setFormError(null)
    setState('verifying')
    try {
      const { data } = await api.post<{ message?: string }>('/auth/verify-email', { token, password })
      setState('verified')
      setMessage(data.message || 'Email verified. You can now sign in.')
    } catch (error) {
      const response = (error as VerifyFailure)?.response
      const serverMessage = typeof response?.data?.message === 'string' ? response.data.message : null
      if (response?.status === 400 || response?.status === 401) {
        setState('form')
        setFormError(serverMessage || 'That password does not match this sign-up.')
        return
      }
      setState('error')
      setMessage(serverMessage || 'This verification link is invalid or has expired.')
    }
  }

  const showForm = state === 'form' || state === 'verifying'

  return (
    <div className="min-h-screen bg-[#0A0808] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] p-8">
        <img src={logo} alt="Your Guava" className="mx-auto mb-8 w-36" />
        {state === 'reading' && (
          <p className="text-center text-sm text-muted" role="status">Opening your link...</p>
        )}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <h1 className="text-xl font-bold text-text">Finish creating your account</h1>
            <p className="text-sm leading-6 text-muted">
              Enter the password you chose when you signed up. It proves this sign-up is yours.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="verify-password">Password</Label>
              <Input
                id="verify-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? ERROR_ID : undefined}
                autoFocus
              />
            </div>
            {formError && (
              <p id={ERROR_ID} className="text-sm text-red-400" role="alert">{formError}</p>
            )}
            <Button type="submit" className="w-full" disabled={state === 'verifying' || password.length === 0}>
              {state === 'verifying' ? 'Verifying...' : 'Verify and finish'}
            </Button>
          </form>
        )}
        {(state === 'verified' || state === 'error') && (
          <div className="text-center">
            <div
              className={
                state === 'error'
                  ? 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/20'
                  : 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-guava-green/10'
              }
            >
              {state === 'verified'
                ? <CheckCircle className="h-6 w-6 text-guava-green" />
                : <AlertCircle className="h-6 w-6 text-red-400" />}
            </div>
            <h1 className="text-xl font-bold text-text">{state === 'verified' ? 'Email verified' : 'Verification failed'}</h1>
            <p className="mt-3 text-sm leading-6 text-muted" role={state === 'error' ? 'alert' : 'status'}>{message}</p>
            <div className="mt-6 flex justify-center gap-4 text-sm">
              <Link className="text-guava-green hover:underline" to="/login">
                {state === 'verified' ? 'Continue to sign in' : 'Back to sign in'}
              </Link>
              {state === 'error' && (
                <Link className="text-guava-green hover:underline" to="/signup">Sign up again</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
