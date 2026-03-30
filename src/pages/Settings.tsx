import { useState, useEffect, type FormEvent } from 'react'
import { Save, Store, User as UserIcon, CheckCircle, AlertCircle, CalendarPlus, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import type { Cafe, LocalEvent } from '@/types'

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

  // Events state
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventImpact, setEventImpact] = useState<'low' | 'medium' | 'high'>('medium')
  const [eventNotes, setEventNotes] = useState('')
  const [eventSaving, setEventSaving] = useState(false)

  // Load cafe data and events on mount
  useEffect(() => {
    api
      .get<Cafe>('/cafe/me')
      .then(({ data }) => {
        setCafeName(data.name)
        setCafeAddress(data.location.address)
        setCafeCity(data.location.city)
      })
      .catch(() => {
        setCafeName('My Cafe')
        setCafeAddress('123 Long Street')
        setCafeCity('Cape Town')
      })

    api
      .get<{ events: LocalEvent[] }>('/events')
      .then(({ data }) => setEvents(data.events))
      .catch(() => {})
  }, [])

  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault()
    if (!eventName || !eventDate) return
    setEventSaving(true)
    try {
      const { data } = await api.post<{ event: LocalEvent }>('/events', {
        name: eventName,
        date: eventDate,
        impact: eventImpact,
        notes: eventNotes || undefined,
      })
      setEvents((prev) => [...prev, data.event].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      setEventName('')
      setEventDate('')
      setEventImpact('medium')
      setEventNotes('')
    } catch {
      // silent fail
    } finally {
      setEventSaving(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.delete(`/events/${id}`)
      setEvents((prev) => prev.filter((ev) => ev._id !== id))
    } catch {
      // silent fail
    }
  }

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
        {/* ── Local Events ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-[#9B59B6]" />
              <CardTitle>Local Events</CardTitle>
            </div>
            <CardDescription>
              Add upcoming local events (markets, festivals, concerts) that may impact your sales forecasts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event list */}
            {events.length === 0 ? (
              <p className="text-[#555555] text-sm text-center py-4">No upcoming events added yet</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div
                    key={ev._id}
                    className="flex items-center justify-between gap-3 bg-[#111111] border border-[#2A2A2A] rounded-lg px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#F0F0F0] text-sm font-medium truncate">{ev.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            ev.impact === 'high'
                              ? 'bg-red-900/30 text-red-400'
                              : ev.impact === 'medium'
                                ? 'bg-yellow-900/30 text-yellow-400'
                                : 'bg-blue-900/30 text-blue-400'
                          }`}
                        >
                          {ev.impact === 'high' ? '+35%' : ev.impact === 'medium' ? '+20%' : '+10%'}
                        </span>
                      </div>
                      <span className="text-[#555555] text-xs">
                        {new Date(ev.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(ev._id)}
                      className="text-[#555555] hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Add event form */}
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Blouberg Saturday Market"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Impact</Label>
                <div className="flex gap-2">
                  {([
                    { value: 'low' as const, label: 'Low +10%', color: 'bg-blue-900/30 text-blue-400 border-blue-900/50' },
                    { value: 'medium' as const, label: 'Medium +20%', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' },
                    { value: 'high' as const, label: 'High +35%', color: 'bg-red-900/30 text-red-400 border-red-900/50' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEventImpact(opt.value)}
                      className={`flex-1 text-xs font-medium py-2 rounded-lg border transition-colors ${
                        eventImpact === opt.value
                          ? opt.color
                          : 'bg-[#1A1A1A] text-[#555555] border-[#2A2A2A] hover:border-[#3A3A3A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-notes">Notes (optional)</Label>
                <Input
                  id="event-notes"
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Expected high foot traffic"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={eventSaving}>
                  {eventSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding...
                    </span>
                  ) : (
                    <>
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Add Event
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
