import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logo from '@/assets/logo.png'

const takeTokenFromFragment = () => {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.search}`
  )
  return token
}

export default function ResetPassword() {
  const [token] = useState(takeTokenFromFragment)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(
    token ? null : 'This reset link is invalid or incomplete.'
  )

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
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          'This reset link is invalid or has expired.'
      )
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
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
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
