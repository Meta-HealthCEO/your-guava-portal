import { useState, useEffect, type FormEvent } from 'react'
import { AlertCircle, CalendarPlus, CheckCircle, Save, Store, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import api from '@/lib/api'
import type { Cafe, LocalEvent } from '@/types'

type SaveState = 'idle' | 'saving' | 'success' | 'error'
type NoticeState = { type: 'success' | 'error'; message: string } | null

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

function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null
  return (
    <div
      className={
        notice.type === 'success'
          ? 'flex items-center gap-2 bg-guava-green/10 border border-guava-green/20 rounded-lg px-3.5 py-2.5 text-sm text-guava-green'
          : 'flex items-center gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400'
      }
    >
      {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span>{notice.message}</span>
    </div>
  )
}

export default function Settings() {
  const [notice, setNotice] = useState<NoticeState>(null)

  const [cafeName, setCafeName] = useState('')
  const [cafeAddress, setCafeAddress] = useState('')
  const [cafeCity, setCafeCity] = useState('')
  const [cafeState, setCafeState] = useState<SaveState>('idle')
  const [cafeError, setCafeError] = useState<string | undefined>()

  const [events, setEvents] = useState<LocalEvent[]>([])
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventImpact, setEventImpact] = useState<'low' | 'medium' | 'high'>('medium')
  const [eventNotes, setEventNotes] = useState('')
  const [eventSaving, setEventSaving] = useState(false)

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  useEffect(() => {
    api
      .get<{ success: boolean; cafe: Cafe }>('/cafe/me')
      .then(({ data }) => {
        const cafe = data.cafe
        setCafeName(cafe.name || '')
        setCafeAddress(cafe.location?.address || '')
        setCafeCity(cafe.location?.city || 'Cape Town')
      })
      .catch(() => {
        setCafeName('My Cafe')
        setCafeAddress('')
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
      showNotice('error', 'Could not add forecast signal.')
    } finally {
      setEventSaving(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.delete(`/events/${id}`)
      setEvents((prev) => prev.filter((ev) => ev._id !== id))
    } catch {
      showNotice('error', 'Could not delete forecast signal.')
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
      const resp = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      setCafeError(resp || undefined)
      setCafeState('error')
    }
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-6">
        <Notice notice={notice} />

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-guava-red" />
                <CardTitle>Cafe Details</CardTitle>
              </div>
              <CardDescription>
                Update the active cafe's name and location for forecasts, weather, and local context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCafeSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cafe-name">Cafe Name</Label>
                  <Input id="cafe-name" value={cafeName} onChange={(e) => setCafeName(e.target.value)} placeholder="The Good Bean" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cafe-address">Street Address</Label>
                  <Input id="cafe-address" value={cafeAddress} onChange={(e) => setCafeAddress(e.target.value)} placeholder="123 Long Street" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cafe-city">City</Label>
                  <Input id="cafe-city" value={cafeCity} onChange={(e) => setCafeCity(e.target.value)} placeholder="Cape Town" />
                </div>
                <StatusBanner state={cafeState} error={cafeError} />
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={cafeState === 'saving'}>
                    <Save className="w-3.5 h-3.5" />
                    {cafeState === 'saving' ? 'Saving...' : 'Save Cafe Details'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-[#9B59B6]" />
                <CardTitle>Forecast Signals</CardTitle>
              </div>
              <CardDescription>
                Manage local events that feed demand forecasting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {events.length === 0 ? (
                <p className="text-[#555555] text-sm text-center py-4">No upcoming signals added yet</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div key={ev._id} className="flex items-center justify-between gap-3 bg-[#111111] border border-border rounded-lg px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-text text-sm font-medium truncate">{ev.name}</span>
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
                      <button type="button" onClick={() => handleDeleteEvent(ev._id)} className="text-[#555555] hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-name">Signal Name</Label>
                  <Input id="event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Blouberg Saturday Market" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-date">Date</Label>
                  <Input id="event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Impact</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'low' as const, label: 'Low +10%', color: 'bg-blue-900/30 text-blue-400 border-blue-900/50' },
                      { value: 'medium' as const, label: 'Medium +20%', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' },
                      { value: 'high' as const, label: 'High +35%', color: 'bg-red-900/30 text-red-400 border-red-900/50' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEventImpact(opt.value)}
                        className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                          eventImpact === opt.value ? opt.color : 'bg-[#111111] text-[#555555] border-border hover:border-[#3A3A3A]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="event-notes">Notes</Label>
                  <Input id="event-notes" value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Expected high foot traffic" />
                </div>
                <div className="flex justify-end md:col-span-2">
                  <Button type="submit" disabled={eventSaving}>
                    <CalendarPlus className="w-3.5 h-3.5" />
                    {eventSaving ? 'Adding...' : 'Add Signal'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
