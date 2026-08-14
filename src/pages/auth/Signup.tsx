import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight, CheckCircle, Mail } from 'lucide-react'
import api from '@/lib/api'
import logo from '@/assets/logo.png'

type RegistrationErrorPayload = {
  code?: string
  email?: string
  message?: string
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null

const registrationErrorPayload = (error: unknown): RegistrationErrorPayload | null => {
  const errorRecord = asRecord(error)
  const responseRecord = asRecord(errorRecord?.response)
  const responseData = asRecord(responseRecord?.data)
  const nestedData = asRecord(responseData?.data)
  const payload = nestedData || responseData || errorRecord
  if (!payload) return null

  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  }
}

export default function Signup() {
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cafeName, setCafeName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsLoading(true)
    const submittedEmail = email.trim().toLowerCase()

    try {
      const result = await register(submittedEmail, password, name, cafeName, orgName.trim() || undefined)
      setVerificationMessage(result.message)
      setPendingEmail(result.email?.trim().toLowerCase() || submittedEmail)
    } catch (err: unknown) {
      const payload = registrationErrorPayload(err)
      if (
        payload?.code === 'VERIFICATION_EMAIL_FAILED' ||
        payload?.code === 'REGISTRATION_PENDING'
      ) {
        setVerificationMessage(
          payload.message || 'Your registration is pending. Request a fresh verification link below.'
        )
        setPendingEmail(payload.email?.trim().toLowerCase() || submittedEmail)
      } else if (payload?.message) {
        setError(payload.message)
      } else {
        setError('Could not create account. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!pendingEmail) return
    setError(null)
    setResent(false)
    setResending(true)
    try {
      await api.post('/auth/resend-verification', { email: pendingEmail })
      setResent(true)
    } catch {
      setError('Could not resend the verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-[#0A0808] flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-guava-green/10">
            <Mail className="h-6 w-6 text-guava-green" />
          </div>
          <h1 className="text-xl font-bold text-text">Verify your email</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {verificationMessage || 'Open the verification link to finish creating your account.'}
          </p>
          <p className="mt-2 text-sm text-muted">
            Verification email: <span className="font-medium text-text">{pendingEmail}</span>
          </p>
          {resent && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-guava-green" role="status">
              <CheckCircle className="h-4 w-4" />
              A fresh link has been sent.
            </div>
          )}
          {error && <p className="mt-5 text-sm text-red-400" role="alert">{error}</p>}
          <Button className="mt-6 w-full" variant="outline" onClick={resendVerification} disabled={resending}>
            {resending ? 'Sending...' : 'Resend verification email'}
          </Button>
          <Link className="mt-5 inline-block text-sm text-guava-green hover:underline" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex">
      {/* Full-page background — coffee shop photo with gradient fallback */}
      <div className="absolute inset-0 bg-[#0A0808]" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=80')` }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/60" />
      {/* Fallback warm glow if image fails to load */}
      <div className="absolute bottom-0 left-0 w-200 h-200 -translate-x-1/3 translate-y-1/3 rounded-full blur-[200px] opacity-10" style={{ background: '#D43D3D' }} />
      <div className="absolute top-0 right-0 w-125 h-125 translate-x-1/4 -translate-y-1/4 rounded-full blur-[180px] opacity-[0.06]" style={{ background: '#4DA63B' }} />

      {/* Center container — logo left, form right */}
      <div className="relative z-10 flex items-center justify-center gap-16 w-full max-w-4xl mx-auto px-6 min-h-screen">
        {/* Left — branding */}
        <div className="hidden lg:block w-85 shrink-0">
          <img src={logo} alt="Your Guava" className="w-48 mx-auto mb-6" />
          <p className="text-white/40 text-center leading-relaxed">
            Know what your customers want<br />before they walk in.
          </p>
          {/* Capability statements, not performance claims. The previous "94%
              Accuracy" sat one screen away from a History page reporting ~88%
              on a typical day, which undermines trust at the front door. */}
          <div className="mt-8 flex items-start justify-center gap-6">
            <div className="text-center whitespace-nowrap">
              <p className="text-guava-green text-2xl font-bold">7 days</p>
              <p className="text-muted text-xs mt-0.5">Forecast ahead</p>
            </div>
            <div className="w-px h-8 bg-white/10 mt-1.5" />
            <div className="text-center whitespace-nowrap">
              <p className="text-guava-red-text text-2xl font-bold">Daily</p>
              <p className="text-muted text-xs mt-0.5">Prep list</p>
            </div>
            <div className="w-px h-8 bg-white/10 mt-1.5" />
            <div className="text-center whitespace-nowrap">
              <p className="text-guava-yellow text-2xl font-bold">Live</p>
              <p className="text-muted text-xs mt-0.5">Weather signals</p>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="Your Guava" className="w-32 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Know what's brewing before they do.</p>
          </div>

          <div className="bg-[#111111]/60 backdrop-blur-xl border border-white/8 rounded-2xl p-8">
            <h1 className="text-text text-xl font-bold tracking-tight mb-1">Welcome to Your Guava</h1>
            <p className="text-muted text-sm mb-6">Create your portal account</p>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-900/20 border border-red-900/40 rounded-lg px-3.5 py-3 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="owner@yourcafe.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cafeName">Cafe name</Label>
                <Input
                  id="cafeName"
                  type="text"
                  placeholder="The Daily Grind"
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Auto-generated if empty"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2 bg-guava-green hover:bg-guava-green/90 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <p className="text-[#3A3A3A] text-xs text-center mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-guava-green hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-white/15 text-xs">
          &copy; {new Date().getFullYear()} Your Guava &mdash; Cape Town, South Africa
        </p>
      </div>
    </div>
  )
}
