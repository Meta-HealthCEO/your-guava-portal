import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Clock,
  Package,
  Zap,
  Cloud,
  Wind,
  Droplets,
  Calendar,
  ChevronDown,
  ChevronUp,
  Upload,
  AlertTriangle,
} from 'lucide-react'

const BoltIcon = Zap
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { Forecast } from '@/types'
import { cn } from '@/lib/utils'

// ─── Mock data (TODO: replace with API data from GET /api/forecasts/today and /api/forecasts/week) ───────────────────
const MOCK_FORECAST: Forecast = {
  _id: 'mock-1',
  date: new Date(Date.now() + 86400000).toISOString(),
  items: [
    { itemName: 'Flat White', predictedQty: 84 },
    { itemName: 'Cappuccino', predictedQty: 61 },
    { itemName: 'Americano', predictedQty: 47 },
    { itemName: 'Muffin', predictedQty: 38 },
    { itemName: 'Croissant', predictedQty: 29 },
    { itemName: 'Sandwich', predictedQty: 22 },
    { itemName: 'Cold Brew', predictedQty: 18 },
    { itemName: 'Still Water', predictedQty: 31 },
  ],
  signals: {
    weather: { temp: 23, condition: 'Partly Cloudy', humidity: 62 },
    loadSheddingStage: 0,
    isPublicHoliday: false,
    isSchoolHoliday: false,
    isPayday: true,
    dayOfWeek: 5,
  },
  totalPredictedRevenue: 8420,
  accuracy: 94.2,
}

const MOCK_WEEKLY_DAYS = [
  { label: 'TODAY', date: new Date(), quality: 'BASIC' as const },
  { label: 'TMRW', date: new Date(Date.now() + 86400000), quality: 'PRO' as const },
  { label: 'SAT', date: new Date(Date.now() + 2 * 86400000), quality: 'PRO' as const },
  { label: 'SUN', date: new Date(Date.now() + 3 * 86400000), quality: 'BASIC' as const },
  { label: 'MON', date: new Date(Date.now() + 4 * 86400000), quality: 'BASIC' as const },
  { label: 'TUE', date: new Date(Date.now() + 5 * 86400000), quality: 'BASIC' as const },
  { label: 'WED', date: new Date(Date.now() + 6 * 86400000), quality: 'BASIC' as const },
]

// TODO: replace with real hourly API data
const MOCK_TIME_PERIODS = [
  {
    id: 'pre-dawn',
    label: 'Pre-Dawn',
    timeRange: '05:00 – 06:00',
    temp: 16,
    items: [
      { name: 'Flat White', qty: 4 },
      { name: 'Americano', qty: 3 },
    ],
    totalQty: 7,
  },
  {
    id: 'early-morning',
    label: 'Early Morning',
    timeRange: '06:00 – 08:00',
    temp: 18,
    items: [
      { name: 'Flat White', qty: 18 },
      { name: 'Cappuccino', qty: 12 },
      { name: 'Muffin', qty: 9 },
    ],
    totalQty: 39,
  },
  {
    id: 'morning-rush',
    label: 'Morning Rush',
    timeRange: '08:00 – 10:00',
    temp: 21,
    items: [
      { name: 'Flat White', qty: 31 },
      { name: 'Cappuccino', qty: 22 },
      { name: 'Croissant', qty: 16 },
      { name: 'Americano', qty: 14 },
    ],
    totalQty: 83,
  },
  {
    id: 'late-morning',
    label: 'Late Morning',
    timeRange: '10:00 – 12:00',
    temp: 23,
    items: [
      { name: 'Flat White', qty: 19 },
      { name: 'Sandwich', qty: 14 },
      { name: 'Cold Brew', qty: 11 },
    ],
    totalQty: 44,
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    timeRange: '12:00 – 15:00',
    temp: 24,
    items: [
      { name: 'Cold Brew', qty: 15 },
      { name: 'Sandwich', qty: 12 },
      { name: 'Still Water', qty: 10 },
    ],
    totalQty: 37,
  },
  {
    id: 'evening',
    label: 'Evening Wind-Down',
    timeRange: '15:00 – 17:00',
    temp: 22,
    items: [
      { name: 'Flat White', qty: 12 },
      { name: 'Cappuccino', qty: 9 },
    ],
    totalQty: 21,
  },
]

const ITEM_STYLE: Record<string, { emoji: string; color: string }> = {
  'Flat White': { emoji: '☕', color: '#D43D3D' },
  'Cappuccino': { emoji: '☕', color: '#C4853A' },
  'Americano': { emoji: '☕', color: '#8B5A3C' },
  'Muffin': { emoji: '🧁', color: '#E58A3C' },
  'Croissant': { emoji: '🥐', color: '#D4A43D' },
  'Sandwich': { emoji: '🥪', color: '#7CB87A' },
  'Cold Brew': { emoji: '❄️', color: '#4A9ECC' },
  'Still Water': { emoji: '💧', color: '#4A9ECC' },
}

function getItemStyle(name: string) {
  return ITEM_STYLE[name] ?? { emoji: '☕', color: '#888888' }
}

function formatZAR(amount: number) {
  return `R ${amount.toLocaleString('en-ZA')}`
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#888888] text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className="text-[#F0F0F0] text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-[#555555] text-xs mt-1">{sub}</p>}
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}18` }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WeatherCard({ signals }: { signals: Forecast['signals'] }) {
  const { weather, loadSheddingStage } = signals
  const conditionIcon =
    weather.condition.toLowerCase().includes('cloud') ? '⛅' :
    weather.condition.toLowerCase().includes('rain') ? '🌧️' :
    weather.condition.toLowerCase().includes('storm') ? '⛈️' : '☀️'

  return (
    <Card className="bg-gradient-to-br from-[#1A2030] to-[#1A1A1A] border-[#2A3048]">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[#888888] text-xs font-medium uppercase tracking-wide mb-2">Tomorrow's Weather</p>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold text-[#F0F0F0]">{weather.temp}°</span>
              <span className="text-4xl mb-1">{conditionIcon}</span>
            </div>
            <p className="text-[#AAB8CC] text-sm mt-1">{weather.condition}</p>
          </div>
          {loadSheddingStage > 0 && (
            <div className="bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-lg px-2.5 py-2 text-center">
              <BoltIcon className="w-4 h-4 text-[#FFD166] mx-auto mb-0.5" />
              <p className="text-[#FFD166] text-xs font-bold">Stage {loadSheddingStage}</p>
              <p className="text-[#FFD166]/60 text-[10px]">Loadshed</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 pt-3 border-t border-[#2A3048]">
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-[#4A9ECC]" />
            <span className="text-[#888888] text-xs">{weather.humidity}% humidity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-[#888888]" />
            <span className="text-[#888888] text-xs">Cape Town</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-[#888888]" />
            <span className="text-[#888888] text-xs">Tomorrow</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ImpactFactor {
  label: string
  value: string
  pct: number
  color: string
  active: boolean
}

function ImpactFactorsCard({ signals }: { signals: Forecast['signals'] }) {
  const factors: ImpactFactor[] = [
    {
      label: 'Weather',
      value: `${signals.weather.condition}`,
      pct: 61,
      color: '#4A9ECC',
      active: true,
    },
    {
      label: 'Payday',
      value: signals.isPayday ? 'Month-end' : 'Not payday',
      pct: signals.isPayday ? 88 : 0,
      color: '#4DA63B',
      active: signals.isPayday,
    },
    {
      label: 'Public Holiday',
      value: signals.isPublicHoliday ? 'Yes' : 'No',
      pct: signals.isPublicHoliday ? 70 : 0,
      color: '#FFD166',
      active: signals.isPublicHoliday,
    },
    {
      label: 'Load Shedding',
      value: signals.loadSheddingStage > 0 ? `Stage ${signals.loadSheddingStage}` : 'None',
      pct: signals.loadSheddingStage > 0 ? 100 - signals.loadSheddingStage * 15 : 100,
      color: signals.loadSheddingStage > 0 ? '#D43D3D' : '#4DA63B',
      active: true,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sales Impact Factors</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#888888] text-xs">{f.label}</span>
              <span
                className="text-xs font-semibold"
                style={{ color: f.active ? f.color : '#555555' }}
              >
                {f.active ? (f.label === 'Payday' ? '+12%' : f.label === 'Weather' ? '+6.1%' : f.label === 'Load Shedding' ? (signals.loadSheddingStage > 0 ? '-8%' : 'None') : 'Holiday') : 'None'}
              </span>
            </div>
            <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${f.pct}%`,
                  backgroundColor: f.active ? f.color : '#2A2A2A',
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ItemCard({ itemName, predictedQty }: { itemName: string; predictedQty: number }) {
  const style = getItemStyle(itemName)
  return (
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 text-center hover:border-[#3A3A3A] transition-colors">
      <div className="text-2xl mb-2">{style.emoji}</div>
      <div
        className="text-3xl font-bold mb-1 tabular-nums"
        style={{ color: style.color }}
      >
        {predictedQty}
      </div>
      <div className="text-[#555555] text-xs leading-tight">{itemName}</div>
    </div>
  )
}

function TimePeriodRow({
  period,
}: {
  period: typeof MOCK_TIME_PERIODS[0]
}) {
  const [expanded, setExpanded] = useState(false)
  const maxQty = Math.max(...MOCK_TIME_PERIODS.map((p) => p.totalQty))

  return (
    <div className="border-b border-[#1F1F1F] last:border-0">
      <button
        className="w-full flex items-center gap-3 py-3 px-1 hover:bg-white/[0.02] transition-colors rounded-lg text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Clock className="w-3.5 h-3.5 text-[#555555] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[#F0F0F0] text-sm font-medium">{period.label}</span>
            <span className="text-[#555555] text-xs">{period.timeRange}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[#888888] text-xs">{period.temp}°C</span>
          <div className="flex items-center gap-1">
            {period.items.slice(0, 3).map((item) => {
              const s = getItemStyle(item.name)
              return (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                  style={{ color: s.color }}
                >
                  {item.qty}
                </span>
              )
            })}
          </div>
          <span className="text-[#555555] text-xs w-8 text-right font-semibold">{period.totalQty}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#555555]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#555555]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-3 space-y-2">
          {period.items.map((item) => {
            const s = getItemStyle(item.name)
            const pct = Math.round((item.qty / maxQty) * 100)
            return (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-[#888888] text-xs w-28 truncate">{item.name}</span>
                <div className="flex-1 h-1.5 bg-[#222222] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
                <span
                  className="text-xs font-semibold tabular-nums w-6 text-right"
                  style={{ color: s.color }}
                >
                  {item.qty}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasData, setHasData] = useState(true)
  const [selectedDayIdx, setSelectedDayIdx] = useState(1) // Default TMRW

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        // TODO: swap mock for real endpoint once backend is ready
        // const { data } = await api.get<Forecast>('/forecasts/tomorrow')
        await api.get('/forecasts/tomorrow').catch(() => null) // ping to check connectivity
        setForecast(MOCK_FORECAST)
        setHasData(true)
      } catch {
        // Use mock data in dev
        setForecast(MOCK_FORECAST)
        setHasData(true)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const topItem = forecast?.items.reduce((a, b) =>
    a.predictedQty > b.predictedQty ? a : b
  )
  const totalItems = forecast?.items.reduce((sum, i) => sum + i.predictedQty, 0) ?? 0
  const peakPeriod = MOCK_TIME_PERIODS.reduce((a, b) => (a.totalQty > b.totalQty ? a : b))

  const kpis = [
    {
      label: 'Forecast Revenue',
      value: forecast ? formatZAR(forecast.totalPredictedRevenue) : '—',
      sub: 'Tomorrow · predicted',
      icon: TrendingUp,
      accent: '#4DA63B',
    },
    {
      label: 'Peak Period',
      value: peakPeriod.label,
      sub: `${peakPeriod.timeRange} · ${peakPeriod.totalQty} items`,
      icon: Clock,
      accent: '#FFD166',
    },
    {
      label: 'Top Item',
      value: topItem?.itemName ?? '—',
      sub: topItem ? `${topItem.predictedQty} units predicted` : undefined,
      icon: Package,
      accent: '#D43D3D',
    },
    {
      label: 'Total Items',
      value: totalItems.toLocaleString(),
      sub: 'Across all menu items',
      icon: Zap,
      accent: '#4A9ECC',
    },
  ]

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!isLoading && !hasData) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#555555]" />
          </div>
          <h2 className="text-[#F0F0F0] text-lg font-semibold mb-2">No data yet</h2>
          <p className="text-[#555555] text-sm mb-6 max-w-xs">
            Upload your Yoco transaction data to start generating forecasts.
          </p>
          <Link to="/connect">
            <Button>
              <Upload className="w-4 h-4" />
              Upload Yoco Data
            </Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Dashboard">
      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-5">
                  <Skeleton className="h-3 w-24 mb-3" />
                  <Skeleton className="h-7 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* ── Day Selector ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {MOCK_WEEKLY_DAYS.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDayIdx(idx)}
            className={cn(
              'flex flex-col items-center px-3.5 py-2 rounded-lg border text-center flex-shrink-0 transition-colors',
              selectedDayIdx === idx
                ? 'bg-[#4DA63B]/10 border-[#4DA63B]/40 text-[#4DA63B]'
                : 'bg-[#111111] border-[#2A2A2A] text-[#888888] hover:text-[#F0F0F0] hover:border-[#3A3A3A]'
            )}
          >
            <span className="text-xs font-bold tracking-wide">{day.label}</span>
            <span className="text-[10px] mt-0.5 opacity-70">{formatDate(day.date)}</span>
            <Badge
              variant={day.quality === 'PRO' ? 'pro' : 'basic'}
              className="mt-1 text-[9px] py-0 px-1.5 h-4"
            >
              {day.quality}
            </Badge>
          </button>
        ))}
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 mb-6">
        {/* Left column */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[160px] rounded-xl" />
              <Skeleton className="h-[200px] rounded-xl" />
            </>
          ) : forecast ? (
            <>
              <WeatherCard signals={forecast.signals} />
              <ImpactFactorsCard signals={forecast.signals} />
            </>
          ) : null}
        </div>

        {/* Right column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#F0F0F0] text-sm font-semibold">
              Tomorrow's Predicted Output
            </h2>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#555555]" />
              <span className="text-[#555555] text-xs">
                {forecast ? new Date(forecast.date).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : forecast ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {forecast.items.map((item) => (
                <ItemCard
                  key={item.itemName}
                  itemName={item.itemName}
                  predictedQty={item.predictedQty}
                />
              ))}
            </div>
          ) : null}

          {/* Signals summary strip */}
          {!isLoading && forecast && (
            <div className="flex flex-wrap gap-2 mt-4">
              {forecast.signals.isPayday && (
                <div className="flex items-center gap-1.5 bg-[#4DA63B]/10 border border-[#4DA63B]/20 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4DA63B]" />
                  <span className="text-[#4DA63B] text-xs font-medium">Payday Weekend</span>
                </div>
              )}
              {forecast.signals.loadSheddingStage > 0 && (
                <div className="flex items-center gap-1.5 bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD166]" />
                  <span className="text-[#FFD166] text-xs font-medium">
                    Loadshedding Stage {forecast.signals.loadSheddingStage}
                  </span>
                </div>
              )}
              {forecast.signals.isPublicHoliday && (
                <div className="flex items-center gap-1.5 bg-[#D43D3D]/10 border border-[#D43D3D]/20 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D43D3D]" />
                  <span className="text-[#D43D3D] text-xs font-medium">Public Holiday</span>
                </div>
              )}
              {forecast.accuracy && (
                <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-3 py-1 ml-auto">
                  <span className="text-[#888888] text-xs">Model accuracy:</span>
                  <span className="text-[#4DA63B] text-xs font-semibold">{forecast.accuracy}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Time-of-Day Breakdown ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Time-of-Day Breakdown</CardTitle>
            <span className="text-[#555555] text-xs">Click a period to expand</span>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : (
            <div>
              {MOCK_TIME_PERIODS.map((period) => (
                <TimePeriodRow key={period.id} period={period} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
