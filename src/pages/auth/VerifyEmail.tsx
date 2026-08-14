import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AlertCircle, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import logo from '@/assets/logo.png'

type VerifyState = 'verifying' | 'verified' | 'error'

export default function VerifyEmail() {
  const [state, setState] = useState<VerifyState>('verifying')
  const [message, setMessage] = useState('Verifying your email address...')
  // undefined = the fragment has not been read yet, null = no usable token.
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const captured = useRef(false)
  const requested = useRef(false)

  // The email link carries the token in the fragment, which is never sent to the
  // hosting server. Capture it before paint, then strip it from history.
  //
  // The ref guard matters: this effect removes the fragment it just read, so a
  // second invocation on the same mount — StrictMode in development, or any
  // remount — would find nothing and mistake a valid link for a malformed one.
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
  }, [])

  useEffect(() => {
    if (token === undefined) return
    if (!token) {
      setState('error')
      setMessage('This verification link is invalid or incomplete.')
      return
    }

    // Verification spends the token, so it has to happen exactly once. A
    // cancel-on-cleanup flag would be wrong here: it would discard the result of
    // an request that has already been redeemed and cannot be repeated.
    if (requested.current) return
    requested.current = true

    api
      .post<{ message?: string }>('/auth/verify-email', { token })
      .then(({ data }) => {
        setState('verified')
        setMessage(data.message || 'Email verified. You can now sign in.')
      })
      .catch((error) => {
        setState('error')
        setMessage(
          error?.response?.data?.message ||
            'This verification link is invalid or has expired.'
        )
      })
  }, [token])

  return (
    <div className="min-h-screen bg-[#0A0808] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] p-8 text-center">
        <img src={logo} alt="Your Guava" className="mx-auto mb-8 w-36" />
        <div
          className={
            state === 'error'
              ? 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/20'
              : 'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-guava-green/10'
          }
        >
          {state === 'verifying' ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-guava-green/30 border-t-guava-green" />
          ) : state === 'verified' ? (
            <CheckCircle className="h-6 w-6 text-guava-green" />
          ) : (
            <AlertCircle className="h-6 w-6 text-red-400" />
          )}
        </div>
        <h1 className="text-xl font-bold text-text">
          {state === 'verifying'
            ? 'Verifying email'
            : state === 'verified'
              ? 'Email verified'
              : 'Verification failed'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted" role={state === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
        {state !== 'verifying' && (
          <Link className="mt-6 inline-block text-sm text-guava-green hover:underline" to="/login">
            {state === 'verified' ? 'Continue to sign in' : 'Back to sign in'}
          </Link>
        )}
      </div>
    </div>
  )
}
