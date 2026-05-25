import { useState, useEffect, type ComponentType, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Cable,
  CheckCircle,
  CircleUserRound,
  Clock,
  CreditCard,
  Pencil,
  Save,
  SlidersHorizontal,
  Store,
  Users,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import type { Cafe, TradingHoursEntry } from '@/types'
import { AccountSettingsContent } from './Account'

type SaveState = 'idle' | 'saving' | 'success' | 'error'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const defaultTradingHours = (): TradingHoursEntry[] => [
  { dayOfWeek: 0, isOpen: false, openTime: '08:00', closeTime: '14:00' },
  { dayOfWeek: 1, isOpen: true, openTime: '07:00', closeTime: '17:00' },
  { dayOfWeek: 2, isOpen: true, openTime: '07:00', closeTime: '17:00' },
  { dayOfWeek: 3, isOpen: true, openTime: '07:00', closeTime: '17:00' },
  { dayOfWeek: 4, isOpen: true, openTime: '07:00', closeTime: '17:00' },
  { dayOfWeek: 5, isOpen: true, openTime: '07:00', closeTime: '17:00' },
  { dayOfWeek: 6, isOpen: true, openTime: '08:00', closeTime: '15:00' },
]

const ensureWeek = (input?: TradingHoursEntry[]): TradingHoursEntry[] => {
  const fallback = defaultTradingHours()
  if (!Array.isArray(input)) return fallback
  return fallback.map((dayDefault) => {
    const provided = input.find((entry) => entry?.dayOfWeek === dayDefault.dayOfWeek)
    return provided
      ? {
          dayOfWeek: dayDefault.dayOfWeek,
          isOpen: provided.isOpen !== false,
          openTime: provided.openTime || dayDefault.openTime,
          closeTime: provided.closeTime || dayDefault.closeTime,
        }
      : dayDefault
  })
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[#555555] text-[11px] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-text text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

const formatTimeRange = (entry: TradingHoursEntry) => {
  if (!entry.isOpen) return 'Closed'
  return `${entry.openTime} – ${entry.closeTime}`
}

function StatusBanner({ state, error }: { state: SaveState; error?: string }) {
  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 bg-guava-green/10 border border-guava-green/20 rounded-lg px-3.5 py-2.5 text-sm text-guava-green">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>Changes saved successfully.</span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error ?? 'Failed to save. Please try again.'}</span>
      </div>
    )
  }

  return null
}

interface LoadedSnapshot {
  cafeName: string
  cafeAddress: string
  cafeAddressLine2: string
  cafeSuburb: string
  cafeCity: string
  cafePostalCode: string
  cafeProvince: string
  cafeCountry: string
  cafeTimezone: string
  tradingHours: TradingHoursEntry[]
}

const ZA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const

const FALLBACK_SNAPSHOT: LoadedSnapshot = {
  cafeName: 'My Cafe',
  cafeAddress: '',
  cafeAddressLine2: '',
  cafeSuburb: '',
  cafeCity: 'Cape Town',
  cafePostalCode: '',
  cafeProvince: '',
  cafeCountry: 'South Africa',
  cafeTimezone: 'Africa/Johannesburg',
  tradingHours: defaultTradingHours(),
}

type SettingsSectionId = 'general' | 'account' | 'billing' | 'prediction' | 'integrations' | 'team'

interface SettingsSection {
  id: SettingsSectionId
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  ownerOnly?: boolean
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Cafe details and trading hours',
    icon: Store,
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Profile and organisation',
    icon: CircleUserRound,
  },
  {
    id: 'billing',
    label: 'Billing & usage',
    description: 'Plan, payment, and credits',
    icon: CreditCard,
  },
  {
    id: 'prediction',
    label: 'Prediction',
    description: 'Forecast factors workspace',
    icon: SlidersHorizontal,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connected systems',
    icon: Cable,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Users and access',
    icon: Users,
    ownerOnly: true,
  },
]

const isSettingsSectionId = (value: string | null): value is SettingsSectionId =>
  SETTINGS_SECTIONS.some((section) => section.id === value)

export default function Settings() {
  const { isOwner } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loaded, setLoaded] = useState<LoadedSnapshot | null>(null)
  const [cafeName, setCafeName] = useState('')
  const [cafeAddress, setCafeAddress] = useState('')
  const [cafeAddressLine2, setCafeAddressLine2] = useState('')
  const [cafeSuburb, setCafeSuburb] = useState('')
  const [cafeCity, setCafeCity] = useState('')
  const [cafePostalCode, setCafePostalCode] = useState('')
  const [cafeProvince, setCafeProvince] = useState('')
  const [cafeCountry, setCafeCountry] = useState('South Africa')
  const [cafeTimezone, setCafeTimezone] = useState('Africa/Johannesburg')
  const [cafeState, setCafeState] = useState<SaveState>('idle')
  const [cafeError, setCafeError] = useState<string | undefined>()
  const [isEditingCafe, setIsEditingCafe] = useState(false)
  const [tradingHours, setTradingHours] = useState<TradingHoursEntry[]>(defaultTradingHours())
  const [hoursState, setHoursState] = useState<SaveState>('idle')
  const [hoursError, setHoursError] = useState<string | undefined>()
  const [isEditingHours, setIsEditingHours] = useState(false)
  const requestedSection = searchParams.get('section')
  const requestedSectionId = isSettingsSectionId(requestedSection) ? requestedSection : 'general'
  const visibleSections = SETTINGS_SECTIONS.filter((section) => !section.ownerOnly || isOwner)
  const activeSection = visibleSections.some((section) => section.id === requestedSectionId)
    ? requestedSectionId
    : 'general'

  const selectSection = (sectionId: SettingsSectionId) => {
    if (sectionId === 'general') {
      setSearchParams({})
      return
    }
    setSearchParams({ section: sectionId })
  }

  const applySnapshot = (snapshot: LoadedSnapshot) => {
    setCafeName(snapshot.cafeName)
    setCafeAddress(snapshot.cafeAddress)
    setCafeAddressLine2(snapshot.cafeAddressLine2)
    setCafeSuburb(snapshot.cafeSuburb)
    setCafeCity(snapshot.cafeCity)
    setCafePostalCode(snapshot.cafePostalCode)
    setCafeProvince(snapshot.cafeProvince)
    setCafeCountry(snapshot.cafeCountry)
    setCafeTimezone(snapshot.cafeTimezone)
    setTradingHours(snapshot.tradingHours)
  }

  useEffect(() => {
    api
      .get<{ success: boolean; cafe: Cafe }>('/cafe/me')
      .then(({ data }) => {
        const cafe = data.cafe
        const snapshot: LoadedSnapshot = {
          cafeName: cafe.name || '',
          cafeAddress: cafe.location?.address || '',
          cafeAddressLine2: cafe.location?.addressLine2 || '',
          cafeSuburb: cafe.location?.suburb || '',
          cafeCity: cafe.location?.city || 'Cape Town',
          cafePostalCode: cafe.location?.postalCode || '',
          cafeProvince: cafe.location?.province || '',
          cafeCountry: cafe.location?.country || 'South Africa',
          cafeTimezone: cafe.timezone || 'Africa/Johannesburg',
          tradingHours: ensureWeek(cafe.tradingHours),
        }
        setLoaded(snapshot)
        applySnapshot(snapshot)
      })
      .catch(() => {
        setLoaded(FALLBACK_SNAPSHOT)
        applySnapshot(FALLBACK_SNAPSHOT)
      })
  }, [])

  const buildLocationPayload = () => ({
    address: cafeAddress,
    addressLine2: cafeAddressLine2,
    suburb: cafeSuburb,
    city: cafeCity,
    postalCode: cafePostalCode,
    province: cafeProvince,
    country: cafeCountry,
  })

  const handleCafeSave = async (e: FormEvent) => {
    e.preventDefault()
    setCafeState('saving')
    setCafeError(undefined)
    try {
      await api.put('/cafe/me', {
        name: cafeName,
        location: buildLocationPayload(),
      })
      setLoaded((prev) =>
        prev
          ? {
              ...prev,
              cafeName,
              cafeAddress,
              cafeAddressLine2,
              cafeSuburb,
              cafeCity,
              cafePostalCode,
              cafeProvince,
              cafeCountry,
            }
          : prev
      )
      setCafeState('success')
      setIsEditingCafe(false)
      setTimeout(() => setCafeState('idle'), 3000)
    } catch (err: unknown) {
      const resp = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      setCafeError(resp || undefined)
      setCafeState('error')
    }
  }

  const handleCafeCancel = () => {
    const snapshot = loaded ?? FALLBACK_SNAPSHOT
    setCafeName(snapshot.cafeName)
    setCafeAddress(snapshot.cafeAddress)
    setCafeAddressLine2(snapshot.cafeAddressLine2)
    setCafeSuburb(snapshot.cafeSuburb)
    setCafeCity(snapshot.cafeCity)
    setCafePostalCode(snapshot.cafePostalCode)
    setCafeProvince(snapshot.cafeProvince)
    setCafeCountry(snapshot.cafeCountry)
    setCafeError(undefined)
    setCafeState('idle')
    setIsEditingCafe(false)
  }

  const updateDay = (dayOfWeek: number, patch: Partial<TradingHoursEntry>) => {
    setTradingHours((current) =>
      current.map((entry) => (entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry))
    )
  }

  const handleHoursSave = async (e: FormEvent) => {
    e.preventDefault()
    setHoursState('saving')
    setHoursError(undefined)
    const invalidDay = tradingHours.find(
      (entry) => entry.isOpen && entry.closeTime <= entry.openTime
    )
    if (invalidDay) {
      setHoursError(`${DAY_LABELS[invalidDay.dayOfWeek]}: closing time must be after opening time.`)
      setHoursState('error')
      return
    }
    try {
      await api.put('/cafe/me', { tradingHours })
      setLoaded((prev) => (prev ? { ...prev, tradingHours } : prev))
      setHoursState('success')
      setIsEditingHours(false)
      setTimeout(() => setHoursState('idle'), 3000)
    } catch (err: unknown) {
      const resp = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      setHoursError(resp || undefined)
      setHoursState('error')
    }
  }

  const handleHoursCancel = () => {
    const snapshot = loaded ?? FALLBACK_SNAPSHOT
    setTradingHours(snapshot.tradingHours.map((entry) => ({ ...entry })))
    setHoursError(undefined)
    setHoursState('idle')
    setIsEditingHours(false)
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 xl:space-y-0 xl:pl-[244px]">
        <aside className="h-fit rounded-lg border border-border bg-surface p-2 xl:fixed xl:left-[calc(15rem+2rem)] xl:top-20 xl:z-20 xl:w-[220px] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <nav className="space-y-1" aria-label="Settings sections">
            {visibleSections.map((section) => {
              const Icon = section.icon
              const active = activeSection === section.id

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section.id)}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'flex w-full items-start gap-3 rounded-lg border-l-2 border-guava-red bg-guava-red/10 px-3 py-2.5 text-left text-guava-red'
                      : 'flex w-full items-start gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-left text-muted transition-colors hover:bg-white/5 hover:text-text'
                  }
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{section.label}</span>
                    <span className={active ? 'block text-xs text-guava-red/80' : 'block text-xs text-[#555555]'}>
                      {section.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {activeSection === 'general' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-guava-red" />
                  <CardTitle>Trading Hours</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Tell Guava when the cafe is open. Closed hours are excluded from analytics so revenue averages and forecast accuracy aren't dragged down by hours you weren't trading.
                </CardDescription>
              </div>
              {!isEditingHours && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingHours(true)}
                  disabled={!loaded}
                  aria-label="Edit trading hours"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingHours ? (
              <form onSubmit={handleHoursSave} className="space-y-4">
                <div className="rounded-lg border border-border bg-[#111111] divide-y divide-border">
                  <div className="hidden sm:grid sm:grid-cols-[140px_120px_1fr_1fr] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-[#555555] font-medium">
                    <span>Day</span>
                    <span>Status</span>
                    <span>Opens</span>
                    <span>Closes</span>
                  </div>
                  {tradingHours.map((entry) => {
                    const dayLabel = DAY_LABELS[entry.dayOfWeek]
                    return (
                      <div
                        key={entry.dayOfWeek}
                        className="grid grid-cols-2 sm:grid-cols-[140px_120px_1fr_1fr] gap-3 px-4 py-3 items-center"
                      >
                        <span className="text-sm font-medium text-text">{dayLabel}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={entry.isOpen}
                          aria-label={`${dayLabel} ${entry.isOpen ? 'open' : 'closed'}`}
                          onClick={() => updateDay(entry.dayOfWeek, { isOpen: !entry.isOpen })}
                          className={
                            entry.isOpen
                              ? 'h-8 px-3 rounded-full text-xs font-medium bg-guava-green/15 text-guava-green border border-guava-green/30 hover:bg-guava-green/25 transition-colors w-fit'
                              : 'h-8 px-3 rounded-full text-xs font-medium bg-[#1a1a1a] text-muted border border-border hover:bg-white/5 transition-colors w-fit'
                          }
                        >
                          {entry.isOpen ? 'Open' : 'Closed'}
                        </button>
                        <Input
                          type="time"
                          aria-label={`${dayLabel} opening time`}
                          value={entry.openTime}
                          onChange={(e) => updateDay(entry.dayOfWeek, { openTime: e.target.value })}
                          disabled={!entry.isOpen}
                          className={!entry.isOpen ? 'opacity-50' : ''}
                        />
                        <Input
                          type="time"
                          aria-label={`${dayLabel} closing time`}
                          value={entry.closeTime}
                          onChange={(e) => updateDay(entry.dayOfWeek, { closeTime: e.target.value })}
                          disabled={!entry.isOpen}
                          className={!entry.isOpen ? 'opacity-50' : ''}
                        />
                      </div>
                    )
                  })}
                </div>
                <StatusBanner state={hoursState} error={hoursError} />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleHoursCancel}
                    disabled={hoursState === 'saving'}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={hoursState === 'saving'}>
                    <Save className="w-3.5 h-3.5" />
                    {hoursState === 'saving' ? 'Saving...' : 'Save Trading Hours'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-[#111111] divide-y divide-border">
                  {tradingHours.map((entry) => {
                    const dayLabel = DAY_LABELS[entry.dayOfWeek]
                    return (
                      <div
                        key={entry.dayOfWeek}
                        className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center"
                      >
                        <span className="text-sm font-medium text-text">{dayLabel}</span>
                        <span
                          className={
                            entry.isOpen
                              ? 'text-sm font-medium text-text tabular-nums'
                              : 'text-xs font-medium text-[#555555] uppercase tracking-wide'
                          }
                        >
                          {formatTimeRange(entry)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <StatusBanner state={hoursState} error={hoursError} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-guava-red" />
                  <CardTitle>Cafe Details</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Update the active cafe's name and location for weather, local context, and forecasting.
                </CardDescription>
              </div>
              {!isEditingCafe && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCafe(true)}
                  disabled={!loaded}
                  aria-label="Edit cafe details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingCafe ? (
              <form onSubmit={handleCafeSave} className="space-y-5 pb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cafe-name">Cafe Name</Label>
                  <Input id="cafe-name" value={cafeName} onChange={(e) => setCafeName(e.target.value)} placeholder="The Good Bean" required />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#555555] font-medium">Address</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cafe-address">Street Address</Label>
                      <Input id="cafe-address" value={cafeAddress} onChange={(e) => setCafeAddress(e.target.value)} placeholder="123 Long Street" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cafe-address-line2">
                        Apartment, suite, floor <span className="text-[#555555] font-normal">(optional)</span>
                      </Label>
                      <Input id="cafe-address-line2" value={cafeAddressLine2} onChange={(e) => setCafeAddressLine2(e.target.value)} placeholder="Shop 4, Ground Floor" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cafe-city">City</Label>
                        <Input id="cafe-city" value={cafeCity} onChange={(e) => setCafeCity(e.target.value)} placeholder="Cape Town" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cafe-province">Province</Label>
                        <select
                          id="cafe-province"
                          value={cafeProvince}
                          onChange={(e) => setCafeProvince(e.target.value)}
                          className="flex h-9 w-full rounded-lg border border-border bg-[#111111] px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guava-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F]"
                        >
                          <option value="">Select a province</option>
                          {ZA_PROVINCES.map((province) => (
                            <option key={province} value={province}>{province}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cafe-suburb">Suburb</Label>
                        <Input id="cafe-suburb" value={cafeSuburb} onChange={(e) => setCafeSuburb(e.target.value)} placeholder="Sea Point" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cafe-postal-code">Postal Code</Label>
                        <Input id="cafe-postal-code" value={cafePostalCode} onChange={(e) => setCafePostalCode(e.target.value)} placeholder="8005" inputMode="numeric" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="cafe-country">Country</Label>
                        <Input id="cafe-country" value={cafeCountry} onChange={(e) => setCafeCountry(e.target.value)} placeholder="South Africa" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-[#0a0a0a] px-3 py-2 text-sm">
                    <span className="text-text font-medium tabular-nums">{cafeTimezone}</span>
                    <span className="text-[#555555] text-xs">Contact support to change</span>
                  </div>
                </div>

                <StatusBanner state={cafeState} error={cafeError} />
                <Separator />
                <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCafeCancel}
                    disabled={cafeState === 'saving'}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={cafeState === 'saving'}>
                    <Save className="w-3.5 h-3.5" />
                    {cafeState === 'saving' ? 'Saving...' : 'Save Cafe Details'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <ReadOnlyField label="Cafe Name" value={cafeName} />

                <div className="space-y-1.5">
                  <p className="text-[#555555] text-[11px] uppercase tracking-wider font-medium">Address</p>
                  <div className="text-text text-sm font-medium leading-relaxed space-y-0.5">
                    {cafeAddress ? <p>{cafeAddress}</p> : <p className="text-[#555555]">—</p>}
                    {cafeAddressLine2 && <p>{cafeAddressLine2}</p>}
                    {(cafeSuburb || cafeCity || cafePostalCode) && (
                      <p>
                        {[cafeSuburb, cafeCity, cafePostalCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {(cafeProvince || cafeCountry) && (
                      <p className="text-muted">
                        {[cafeProvince, cafeCountry].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <ReadOnlyField label="Timezone" value={cafeTimezone} />
                </div>

                <StatusBanner state={cafeState} error={cafeError} />
              </div>
            )}
          </CardContent>
        </Card>
            </div>
          )}

          {activeSection === 'account' && <AccountSettingsContent section="account" />}
          {activeSection === 'billing' && <AccountSettingsContent section="billing" />}

          {activeSection === 'prediction' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-guava-green" />
              <CardTitle>Forecast Factors</CardTitle>
            </div>
            <CardDescription>
              Events, factor weighting, plan unlocks, and model impact now live in one dedicated workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-[#111111] p-4">
              <p className="text-sm font-medium text-text">Configure the prediction algorithm in Planning.</p>
              <p className="mt-1 text-sm text-muted">
                This keeps weather, holidays, events, payday rules, and learning correction together instead of splitting them across Settings.
              </p>
            </div>
            <div className="flex justify-end">
              <Link to="/planning/factors">
                <Button type="button">
                  Open Forecast Factors
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
          )}

          {activeSection === 'integrations' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cable className="w-4 h-4 text-guava-green" />
                  <CardTitle>Integrations</CardTitle>
                </div>
                <CardDescription>
                  POS, accounting, and operations connections are grouped here as they become available.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-[#111111] p-4">
                  <p className="text-sm font-medium text-text">Connection workspace</p>
                  <p className="mt-1 text-sm text-muted">
                    Integrations remain a dedicated page for connection status and provider setup.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Link to="/integrations">
                    <Button type="button">
                      Open Integrations
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'team' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-guava-green" />
                  <CardTitle>Team</CardTitle>
                </div>
                <CardDescription>
                  Manage users, owner access, and cafe membership from the team workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-[#111111] p-4">
                  <p className="text-sm font-medium text-text">Access management</p>
                  <p className="mt-1 text-sm text-muted">
                    User invitations and roles stay together with the rest of account setup.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Link to="/team">
                    <Button type="button">
                      Open Team
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
