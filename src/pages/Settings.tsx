import { useState, useEffect, type FormEvent } from 'react'
import { Save, Store, User as UserIcon, CheckCircle, AlertCircle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import type { Cafe } from '@/types'

type SaveState = 'idle' | 'saving' | 'success' | 'error'

function StatusBanner({ state, error }: { state: SaveState; error?: string }) {
  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 bg-[#4DA63B]/10 border border-[#4DA63B]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#4DA63B]">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Changes saved successfully.</span>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error ?? 'Failed to save. Please try again.'}</span>
      </div>
    )
  }
  return null
}

export default function Settings() {
  const { user } = useAuth()

  // Cafe form state
  const [cafeName, setCafeName] = useState('')
  const [cafeAddress, setCafeAddress] = useState('')
  const [cafeCity, setCafeCity] = useState('')
  const [cafeState, setCafeState] = useState<SaveState>('idle')
  const [cafeError, setCafeError] = useState<string | undefined>()

  // Load cafe data on mount
  useEffect(() => {
    api
      .get<Cafe>('/cafe/me')
      .then(({ data }) => {
        setCafeName(data.name)
        setCafeAddress(data.location.address)
        setCafeCity(data.location.city)
      })
      .catch(() => {
        // Use placeholders if API not yet available
        setCafeName('My Cafe')
        setCafeAddress('123 Long Street')
        setCafeCity('Cape Town')
      })
  }, [])

  const handleCafeSave = async (e: FormEvent) => {
    e.preventDefault()
    setCafeState('saving')
    setCafeError(undefined)
    try {
      await api.put('/cafe/me', {
        name: cafeName,
        location: { address: cafeAddress, city: cafeCity },
      })
      setCafeState('success')
      setTimeout(() => setCafeState('idle'), 3000)
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
      setCafeError(msg ?? undefined)
      setCafeState('error')
    }
  }

  return (
    <AppLayout title="Settings">
      <div className="max-w-lg space-y-6">
        {/* ── Cafe Details ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#D43D3D]" />
              <CardTitle>Cafe Details</CardTitle>
            </div>
            <CardDescription>
              Update your cafe's name and location. This is used to enrich your forecasts with local data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCafeSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cafe-name">Cafe Name</Label>
                <Input
                  id="cafe-name"
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="The Good Bean"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cafe-address">Street Address</Label>
                <Input
                  id="cafe-address"
                  value={cafeAddress}
                  onChange={(e) => setCafeAddress(e.target.value)}
                  placeholder="123 Long Street"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cafe-city">City</Label>
                <Input
                  id="cafe-city"
                  value={cafeCity}
                  onChange={(e) => setCafeCity(e.target.value)}
                  placeholder="Cape Town"
                />
              </div>

              <StatusBanner state={cafeState} error={cafeError} />

              <Separator />

              <div className="flex justify-end">
                <Button type="submit" disabled={cafeState === 'saving'}>
                  {cafeState === 'saving' ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Cafe Details
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Profile ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#888888]" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>
              Your account details. Contact support to update your email or password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-[#888888]">Full Name</Label>
              <Input
                id="profile-name"
                value={user?.name ?? ''}
                readOnly
                className="opacity-60 cursor-default"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-[#888888]">Email Address</Label>
              <Input
                id="profile-email"
                value={user?.email ?? ''}
                readOnly
                className="opacity-60 cursor-default"
              />
            </div>
            <p className="text-[#3A3A3A] text-xs pt-1">
              Profile editing coming soon. Contact{' '}
              <span className="text-[#555555]">support@yourguava.co.za</span>{' '}
              for account changes.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
