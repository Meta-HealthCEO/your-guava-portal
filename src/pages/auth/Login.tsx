import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight } from 'lucide-react'
import logo from '@/assets/logo.png'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        setError(String((err.response.data as { message: string }).message))
      } else {
        setError('Invalid email or password. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex">
      {/* Full-page background — coffee shop photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=80')` }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/40" />

      {/* Center container — logo left, form right */}
      <div className="relative z-10 flex items-center justify-center gap-16 w-full max-w-4xl mx-auto px-6 min-h-screen">
        {/* Left — branding */}
        <div className="hidden lg:block w-[340px] shrink-0">
          <img src={logo} alt="Your Guava" className="w-48 mx-auto mb-6" />
          <p className="text-white/40 text-center leading-relaxed">
            Know what your customers want<br />before they walk in.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-guava-green text-2xl font-bold">94%</p>
              <p className="text-[#555555] text-xs mt-0.5">Accuracy</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-guava-red text-2xl font-bold">30%</p>
              <p className="text-[#555555] text-xs mt-0.5">Less Waste</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-guava-yellow text-2xl font-bold">200+</p>
              <p className="text-[#555555] text-xs mt-0.5">Cafes</p>
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
            <h1 className="text-[#F0F0F0] text-xl font-bold tracking-tight mb-1">Welcome back</h1>
            <p className="text-[#555555] text-sm mb-6">Sign in to your portal</p>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-900/20 border border-red-900/40 rounded-lg px-3.5 py-3 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <p className="text-[#3A3A3A] text-xs text-center mt-6">
              Your account is created by your administrator.
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
