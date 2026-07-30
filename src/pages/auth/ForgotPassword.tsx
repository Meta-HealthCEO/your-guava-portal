import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logo from '@/assets/logo.png'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Could not submit the request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0808] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] p-8">
        <img src={logo} alt="Your Guava" className="mx-auto mb-8 w-36" />
        <h1 className="text-xl font-bold text-text">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Enter your sign-in email. If an account exists, we’ll send a one-time reset link.
        </p>

        {sent ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded-lg border border-guava-green/20 bg-guava-green/10 p-4 text-sm text-guava-green" role="status">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Check your inbox for a password reset link.
            </div>
            <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setSent(false)}>
              Send another link
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        )}
        <Link className="mt-6 block text-center text-sm text-guava-green hover:underline" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
