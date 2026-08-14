import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  CheckCircle,
  CloudSun,
  Percent,
  Save,
  SlidersHorizontal,
  Trash2,
  Zap,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ModelLearningPanel } from '@/components/forecasts/ModelLearningPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { isWeatherAvailable, weatherUnavailableReason } from '@/lib/forecastSignals'
import type {
  EventSalesEffect,
  Forecast,
  ForecastFactor,
  ForecastFactorEntitlement,
  ForecastFactorEntitlements,
  ForecastFactorSettings,
  LocalEvent,
} from '@/types'

type Notice = { type: 'success' | 'error'; message: string } | null
type FactorTab = 'live' | 'rules' | 'events'

const fmtPct = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${Number(number.toFixed(1))}%`
}

const fmtZar = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `R${Number(value).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
}

const fmtDate = (value: string) =>
  new Date(value).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm',
        notice.type === 'success'
          ? 'border-guava-green/20 bg-guava-green/10 text-guava-green'
          : 'border-red-900/30 bg-red-900/10 text-red-400'
      )}
    >
      {notice.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {notice.message}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={cn(
      'flex items-center justify-between gap-3 rounded-lg border border-border bg-[#111111] px-3 py-2.5',
      disabled && 'opacity-55'
    )}>
      <span className="text-sm font-medium text-text">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-guava-green"
      />
    </label>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = -90,
  max = 200,
  suffix = '%',
  disabled = false,
}: {
  id: string
  label: string
  value: number
  onChange: (value: string) => void
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          {suffix}
        </span>
      </div>
    </div>
  )
}

function FactorRuleCard({
  title,
  icon,
  children,
  entitlement,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  entitlement?: ForecastFactorEntitlement
}) {
  const locked = entitlement && !entitlement.unlocked
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          {locked && <Badge variant="secondary">{entitlement.requiredPlan}</Badge>}
        </div>
        {entitlement && (
          <CardDescription>
            {locked ? `Unlock on ${entitlement.requiredPlan}. ` : ''}{entitlement.summary}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn('space-y-3', locked && 'opacity-70')}>{children}</CardContent>
    </Card>
  )
}

function activeFactorKey(factor: ForecastFactor) {
  return factor.key || factor.label
}

export default function Factors() {
  const [tab, setTab] = useState<FactorTab>('live')
  const [settings, setSettings] = useState<ForecastFactorSettings | null>(null)
  const [defaults, setDefaults] = useState<ForecastFactorSettings | null>(null)
  const [entitlements, setEntitlements] = useState<ForecastFactorEntitlements | null>(null)
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [eventEffects, setEventEffects] = useState<EventSalesEffect[]>([])
  const [eventEffectSummary, setEventEffectSummary] = useState<{
    eventsAnalyzed: number
    avgRevenueImpactPct: number | null
    aboveExpected: number
    belowExpected: number
    insufficientData: number
  } | null>(null)
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [supportingDataWarning, setSupportingDataWarning] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventImpact, setEventImpact] = useState<'low' | 'medium' | 'high'>('medium')
  const [eventImpactPct, setEventImpactPct] = useState('')
  const [eventNotes, setEventNotes] = useState('')

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  const load = async () => {
    setLoading(true)
    setSupportingDataWarning('')
    try {
      const [factorRes, eventRes, effectRes, weekRes] = await Promise.all([
        api.get<{
          defaults: ForecastFactorSettings
          settings: ForecastFactorSettings
          entitlements: ForecastFactorEntitlements
        }>('/forecasts/factors'),
        api.get<{ events: LocalEvent[] }>('/events'),
        api.get<{
          effects: EventSalesEffect[]
          summary: {
            eventsAnalyzed: number
            avgRevenueImpactPct: number | null
            aboveExpected: number
            belowExpected: number
            insufficientData: number
          }
        }>('/events/effects').catch(() => null),
        api.get<{ forecasts: Forecast[] }>('/forecasts/week').catch(() => null),
      ])
      setDefaults(factorRes.data.defaults)
      setSettings(factorRes.data.settings)
      setEntitlements(factorRes.data.entitlements)
      setEvents(eventRes.data.events)
      setEventEffects(effectRes?.data.effects || [])
      setEventEffectSummary(effectRes?.data.summary || null)
      setForecasts(weekRes?.data.forecasts || [])
      const unavailable = [
        !weekRes ? 'live forecast factors' : '',
        !effectRes ? 'historical event effects' : '',
      ].filter(Boolean)
      if (unavailable.length > 0) {
        setSupportingDataWarning(
          `${unavailable.join(' and ')} could not be loaded. Empty values below do not mean that no factors or effects exist.`
        )
      }
    } catch {
      showNotice('error', 'Could not load forecast factors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const activeFactors = useMemo(
    () => forecasts.flatMap((forecast) => forecast.factors || []).filter((factor) => factor.active),
    [forecasts]
  )

  const factorCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; effect?: string }>()
    activeFactors.forEach((factor) => {
      const key = activeFactorKey(factor)
      const current = counts.get(key) || { label: factor.label, count: 0, effect: factor.effect }
      counts.set(key, { ...current, count: current.count + 1, effect: factor.effect || current.effect })
    })
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [activeFactors])

  const nextEvent = events[0]
  const activeEventDays = forecasts.filter((forecast) => (forecast.signals.events || []).length > 0).length

  const defaultEventPct = (impact: 'low' | 'medium' | 'high') => {
    if (!settings) return impact === 'high' ? 35 : impact === 'medium' ? 20 : 10
    if (impact === 'high') return settings.events.highPct
    if (impact === 'medium') return settings.events.mediumPct
    return settings.events.lowPct
  }

  const entitlementFor = (keyOrSection: string) =>
    entitlements?.factors.find((factor) => factor.key === keyOrSection || factor.section === keyOrSection)

  const isUnlocked = (keyOrSection: string) => entitlementFor(keyOrSection)?.unlocked ?? true
  const lockedCount = entitlements?.lockedKeys.length ?? 0
  const unlockedCount = entitlements?.unlockedKeys.length ?? 0
  const planLabel = entitlements?.plan ? entitlements.plan[0].toUpperCase() + entitlements.plan.slice(1) : 'Starter'
  const eventsUnlocked = isUnlocked('events')

  const updateNumber = <
    Section extends keyof ForecastFactorSettings,
    Key extends keyof ForecastFactorSettings[Section]
  >(section: Section, key: Key, value: string) => {
    const parsed = Number(value)
    setSettings((current) => {
      if (!current || !Number.isFinite(parsed)) return current
      return {
        ...current,
        [section]: {
          ...current[section],
          [key]: parsed,
        },
      }
    })
  }

  const updateBoolean = <
    Section extends keyof ForecastFactorSettings,
    Key extends keyof ForecastFactorSettings[Section]
  >(section: Section, key: Key, value: boolean) => {
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        [section]: {
          ...current[section],
          [key]: value,
        },
      }
    })
  }

  const resetSettings = () => {
    if (defaults) setSettings(defaults)
  }

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const { data } = await api.put<{
        settings: ForecastFactorSettings
        entitlements: ForecastFactorEntitlements
      }>('/forecasts/factors', { settings })
      setSettings(data.settings)
      setEntitlements(data.entitlements)
      showNotice('success', 'Factors saved. Future forecasts will regenerate.')
      await load()
    } catch {
      showNotice('error', 'Could not save factors.')
    } finally {
      setSaving(false)
    }
  }

  const addEvent = async (event: FormEvent) => {
    event.preventDefault()
    if (!eventsUnlocked) {
      showNotice('error', 'Local event factors unlock on Growth.')
      return
    }
    if (!eventName || !eventDate) return
    setEventSaving(true)
    try {
      const { data } = await api.post<{ event: LocalEvent }>('/events', {
        name: eventName,
        date: eventDate,
        impact: eventImpact,
        impactPct: eventImpactPct === '' ? undefined : Number(eventImpactPct),
        notes: eventNotes || undefined,
      })
      setEvents((current) => [...current, data.event].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      setEventName('')
      setEventDate('')
      setEventImpact('medium')
      setEventImpactPct('')
      setEventNotes('')
      showNotice('success', 'Event added.')
      await load()
    } catch {
      showNotice('error', 'Could not add event.')
    } finally {
      setEventSaving(false)
    }
  }

  const deleteEvent = async (id: string) => {
    try {
      await api.delete(`/events/${id}`)
      setEvents((current) => current.filter((event) => event._id !== id))
      showNotice('success', 'Event removed.')
      await load()
    } catch {
      showNotice('error', 'Could not remove event.')
    }
  }

  return (
    <AppLayout title="Factors">
      <div className="space-y-5">
        <NoticeBanner notice={notice} />
        {supportingDataWarning && (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200"
            role="status"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{supportingDataWarning}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted">Active this week</p>
              <p className="mt-1 text-2xl font-bold text-text">{activeFactors.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted">Event days</p>
              <p className="mt-1 text-2xl font-bold text-text">{activeEventDays}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted">Avg event lift</p>
              <p className="mt-1 text-2xl font-bold text-text">{fmtPct(eventEffectSummary?.avgRevenueImpactPct)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted">Next event</p>
              <p className="mt-1 truncate text-lg font-semibold text-text">{nextEvent ? nextEvent.name : '-'}</p>
            </CardContent>
          </Card>
        </div>

        {entitlements && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">{planLabel}</Badge>
                  <p className="text-sm font-semibold text-text">{unlockedCount} factors unlocked</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Planning uses only the factors unlocked for this plan. Locked factor settings are visible, but they are not applied to predictions.
                </p>
              </div>
              {lockedCount > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entitlements.factors.filter((factor) => !factor.unlocked).map((factor) => (
                    <Badge key={factor.key} variant="secondary">
                      {factor.label}: {factor.requiredPlan}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && (
          <ModelLearningPanel
            sources={forecasts}
            entitlements={entitlements}
            settings={settings}
          />
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Forecast Factors</CardTitle>
                <CardDescription>Weather, holidays, payday, load shedding, local events, and stock buffers.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={tab === 'live' ? 'success' : 'outline'} size="sm" onClick={() => setTab('live')}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Live Factors
                </Button>
                <Button variant={tab === 'rules' ? 'success' : 'outline'} size="sm" onClick={() => setTab('rules')}>
                  <Percent className="h-3.5 w-3.5" />
                  Rules
                </Button>
                <Button variant={tab === 'events' ? 'success' : 'outline'} size="sm" onClick={() => setTab('events')}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Events
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-sm text-muted">Loading factors...</div>
            ) : tab === 'live' ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-lg border border-border bg-[#111111] p-4">
                    <p className="text-sm font-semibold text-text">Active factor mix</p>
                    <div className="mt-3 space-y-2">
                      {factorCounts.length === 0 ? (
                        <p className="text-sm text-muted">No active factors in the next 7 days.</p>
                      ) : (
                        factorCounts.map((factor) => (
                          <div key={factor.label} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-text">{factor.label}</p>
                              <p className="text-xs text-muted">{factor.effect || 'active'}</p>
                            </div>
                            <Badge>{factor.count} days</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="overflow-auto rounded-lg border border-border">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-[#111111] text-left text-xs uppercase tracking-wide text-[#9E9E9E]">
                        <tr>
                          <th className="px-3 py-2">Day</th>
                          <th className="px-3 py-2">Forecast</th>
                          <th className="px-3 py-2">Signals</th>
                          <th className="px-3 py-2">Active factors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecasts.map((forecast) => {
                          const active = (forecast.factors || []).filter((factor) => factor.active)
                          return (
                            <tr key={forecast._id} className="border-t border-border">
                              <td className="px-3 py-3 text-text">{fmtDate(forecast.date)}</td>
                              <td className="px-3 py-3 text-muted">
                                R{Number(forecast.totalPredictedRevenue || 0).toLocaleString('en-ZA')}
                              </td>
                              <td className="px-3 py-3 text-muted">
                                {isWeatherAvailable(forecast.signals.weather)
                                  ? `${forecast.signals.weather.temp}C - ${forecast.signals.weather.condition}`
                                  : weatherUnavailableReason(forecast.signals.weather)}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {active.length === 0 ? (
                                    <span className="text-xs text-muted">None</span>
                                  ) : (
                                    active.map((factor) => (
                                      <Badge key={`${forecast._id}-${factor.key}`} variant="secondary">
                                        {factor.label} {factor.effect && factor.effect !== 'no effect' ? factor.effect : ''}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : tab === 'rules' && settings ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <FactorRuleCard title="Weather" icon={<CloudSun className="h-4 w-4 text-[#4A9ECC]" />} entitlement={entitlementFor('weather')}>
                    <ToggleRow label="Weather enabled" checked={settings.weather.enabled} disabled={!isUnlocked('weather')} onChange={(value) => updateBoolean('weather', 'enabled', value)} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField id="weather-hot" label="Hot day starts at" value={settings.weather.hotTemp} min={-10} max={45} suffix="C" disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'hotTemp', value)} />
                      <NumberField id="weather-cold" label="Cold day below" value={settings.weather.coldTemp} min={-10} max={45} suffix="C" disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'coldTemp', value)} />
                      <NumberField id="weather-rain" label="Rain" value={settings.weather.rainPct} disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'rainPct', value)} />
                      <NumberField id="weather-hot-cold-drinks" label="Hot day cold drinks" value={settings.weather.hotColdDrinkPct} disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'hotColdDrinkPct', value)} />
                      <NumberField id="weather-hot-coffee" label="Hot day coffee" value={settings.weather.hotCoffeePct} disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'hotCoffeePct', value)} />
                      <NumberField id="weather-cold-coffee" label="Cold day coffee" value={settings.weather.coldCoffeePct} disabled={!isUnlocked('weather')} onChange={(value) => updateNumber('weather', 'coldCoffeePct', value)} />
                    </div>
                  </FactorRuleCard>

                  <FactorRuleCard title="Calendar" icon={<CalendarDays className="h-4 w-4 text-guava-yellow" />} entitlement={entitlementFor('holiday')}>
                    <ToggleRow label="Holiday factors enabled" checked={settings.holiday.enabled} disabled={!isUnlocked('holiday')} onChange={(value) => updateBoolean('holiday', 'enabled', value)} />
                    <ToggleRow label="Payday factor enabled (Growth)" checked={settings.payday.enabled} disabled={!isUnlocked('payday')} onChange={(value) => updateBoolean('payday', 'enabled', value)} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField id="holiday-public" label="Public holiday" value={settings.holiday.publicPct} disabled={!isUnlocked('holiday')} onChange={(value) => updateNumber('holiday', 'publicPct', value)} />
                      <NumberField id="holiday-school" label="School holiday" value={settings.holiday.schoolPct} disabled={!isUnlocked('holiday')} onChange={(value) => updateNumber('holiday', 'schoolPct', value)} />
                      <NumberField id="holiday-combined" label="Public + school holiday" value={settings.holiday.combinedPct} disabled={!isUnlocked('holiday')} onChange={(value) => updateNumber('holiday', 'combinedPct', value)} />
                      <NumberField id="payday" label="Payday (Growth)" value={settings.payday.pct} disabled={!isUnlocked('payday')} onChange={(value) => updateNumber('payday', 'pct', value)} />
                    </div>
                  </FactorRuleCard>

                  <FactorRuleCard title="Load Shedding" icon={<Zap className="h-4 w-4 text-amber-300" />} entitlement={entitlementFor('loadShedding')}>
                    <ToggleRow label="Load shedding enabled" checked={settings.loadShedding.enabled} disabled={!isUnlocked('loadShedding')} onChange={(value) => updateBoolean('loadShedding', 'enabled', value)} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <NumberField id="load-1-2" label="Stage 1-2" value={settings.loadShedding.stage1To2Pct} disabled={!isUnlocked('loadShedding')} onChange={(value) => updateNumber('loadShedding', 'stage1To2Pct', value)} />
                      <NumberField id="load-3-4" label="Stage 3-4" value={settings.loadShedding.stage3To4Pct} disabled={!isUnlocked('loadShedding')} onChange={(value) => updateNumber('loadShedding', 'stage3To4Pct', value)} />
                      <NumberField id="load-5-plus" label="Stage 5+" value={settings.loadShedding.stage5PlusPct} disabled={!isUnlocked('loadShedding')} onChange={(value) => updateNumber('loadShedding', 'stage5PlusPct', value)} />
                    </div>
                  </FactorRuleCard>

                  <FactorRuleCard title="Events" icon={<Percent className="h-4 w-4 text-[#9B59B6]" />} entitlement={entitlementFor('events')}>
                    <ToggleRow label="Event factors enabled" checked={settings.events.enabled} disabled={!isUnlocked('events')} onChange={(value) => updateBoolean('events', 'enabled', value)} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField id="event-low" label="Low event" value={settings.events.lowPct} disabled={!isUnlocked('events')} onChange={(value) => updateNumber('events', 'lowPct', value)} />
                      <NumberField id="event-medium" label="Medium event" value={settings.events.mediumPct} disabled={!isUnlocked('events')} onChange={(value) => updateNumber('events', 'mediumPct', value)} />
                      <NumberField id="event-high" label="High event" value={settings.events.highPct} disabled={!isUnlocked('events')} onChange={(value) => updateNumber('events', 'highPct', value)} />
                    </div>
                  </FactorRuleCard>

                  <FactorRuleCard title="Stock Buffer" icon={<Percent className="h-4 w-4 text-guava-green" />} entitlement={entitlementFor('stock')}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField id="stock-safety" label="Safety margin" value={settings.stock.safetyMarginPct} min={0} max={100} disabled={!isUnlocked('stock')} onChange={(value) => updateNumber('stock', 'safetyMarginPct', value)} />
                      <NumberField id="stock-bias" label="Stock bias cap" value={settings.stock.maxBiasPct} min={0} max={100} disabled={!isUnlocked('stock')} onChange={(value) => updateNumber('stock', 'maxBiasPct', value)} />
                    </div>
                  </FactorRuleCard>

                  <FactorRuleCard title="History & Learning" icon={<SlidersHorizontal className="h-4 w-4 text-[#4A9ECC]" />} entitlement={entitlementFor('learning')}>
                    <ToggleRow label="Learning correction enabled" checked={settings.learning.enabled} disabled={!isUnlocked('learning')} onChange={(value) => updateBoolean('learning', 'enabled', value)} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <NumberField id="history-weeks" label="History lookback" value={settings.history.maxWeeks} min={1} max={16} suffix="wks" disabled={!isUnlocked('history')} onChange={(value) => updateNumber('history', 'maxWeeks', value)} />
                    </div>
                  </FactorRuleCard>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetSettings}>
                    Reset Defaults
                  </Button>
                  <Button type="button" onClick={saveSettings} disabled={saving}>
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save Factors'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="h-4 w-4 text-[#9B59B6]" />
                      <CardTitle>Add Event</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={addEvent} className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="factor-event-name">Event name</Label>
                          <Input id="factor-event-name" value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Saturday market" disabled={!eventsUnlocked} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="factor-event-date">Date</Label>
                          <Input id="factor-event-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} disabled={!eventsUnlocked} required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Impact</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'low' as const, label: `Low ${fmtPct(defaultEventPct('low'))}` },
                            { value: 'medium' as const, label: `Medium ${fmtPct(defaultEventPct('medium'))}` },
                            { value: 'high' as const, label: `High ${fmtPct(defaultEventPct('high'))}` },
                          ]).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              disabled={!eventsUnlocked}
                              onClick={() => setEventImpact(option.value)}
                              className={cn(
                                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                                !eventsUnlocked && 'cursor-not-allowed opacity-50',
                                eventImpact === option.value
                                  ? 'border-guava-green/30 bg-guava-green/10 text-guava-green'
                                  : 'border-border bg-[#111111] text-muted hover:border-[#3A3A3A]'
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="factor-event-impact">Custom impact</Label>
                          <Input id="factor-event-impact" type="number" min={-90} max={200} step={1} value={eventImpactPct} onChange={(event) => setEventImpactPct(event.target.value)} placeholder={`${defaultEventPct(eventImpact)}`} disabled={!eventsUnlocked} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="factor-event-notes">Notes</Label>
                          <Input id="factor-event-notes" value={eventNotes} onChange={(event) => setEventNotes(event.target.value)} placeholder="High foot traffic" disabled={!eventsUnlocked} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={eventSaving || !eventsUnlocked}>
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {eventSaving ? 'Adding...' : 'Add Event'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Upcoming Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {events.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted">No upcoming events.</p>
                    ) : (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <div key={event._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#111111] px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-text">{event.name}</p>
                                <Badge variant="secondary">{fmtPct(event.impactPct ?? defaultEventPct(event.impact))}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted">{fmtDate(event.date)}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => deleteEvent(event._id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle>Past Event Results</CardTitle>
                        <CardDescription>Actual sales compared with normal same-weekday trading.</CardDescription>
                      </div>
                      {eventEffectSummary && (
                        <Badge variant="secondary">{eventEffectSummary.eventsAnalyzed} measured</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {eventEffects.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted">
                        Add events and upload sales for those dates to measure their effect.
                      </p>
                    ) : (
                      <div className="overflow-auto rounded-lg border border-border">
                        <table className="w-full min-w-[920px] text-sm">
                          <thead className="bg-[#111111] text-left text-xs uppercase tracking-wide text-[#9E9E9E]">
                            <tr>
                              <th className="px-3 py-2">Event</th>
                              <th className="px-3 py-2">Actual sales</th>
                              <th className="px-3 py-2">Normal day</th>
                              <th className="px-3 py-2">Sales lift</th>
                              <th className="px-3 py-2">Expected</th>
                              <th className="px-3 py-2">Difference</th>
                              <th className="px-3 py-2">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventEffects.map((effect) => (
                              <tr key={effect.eventId} className="border-t border-border">
                                <td className="px-3 py-3">
                                  <p className="font-medium text-text">{effect.name}</p>
                                  <p className="mt-1 text-xs text-muted">{fmtDate(effect.date)}</p>
                                </td>
                                <td className="px-3 py-3 text-text">
                                  {fmtZar(effect.actualRevenue)}
                                  <p className="mt-1 text-xs text-muted">{effect.actualTransactions} transactions</p>
                                </td>
                                <td className="px-3 py-3 text-muted">
                                  {fmtZar(effect.baselineRevenue)}
                                  <p className="mt-1 text-xs">{effect.baselineDayCount} comparable days</p>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={cn(
                                    'font-semibold',
                                    (effect.revenueImpactPct ?? 0) >= 0 ? 'text-guava-green' : 'text-red-400'
                                  )}>
                                    {fmtPct(effect.revenueImpactPct)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-muted">{fmtPct(effect.expectedImpactPct)}</td>
                                <td className="px-3 py-3">
                                  <span className={cn(
                                    'font-medium',
                                    (effect.vsExpectedPct ?? 0) >= 0 ? 'text-guava-green' : 'text-amber-300'
                                  )}>
                                    {fmtPct(effect.vsExpectedPct)}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <Badge variant={effect.confidence === 'high' ? 'success' : 'secondary'}>
                                    {effect.confidence}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
