import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Clock,
  Zap,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Wind,
  ChevronDown,
  ChevronUp,
  Upload,
  AlertTriangle,
  Coffee,
  Snowflake,
  UtensilsCrossed,
  ShoppingBag,
  Crown,
  CakeSlice,
  Croissant,
  Sandwich,
  Cookie,
  GlassWater,
  Leaf,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { Forecast, ForecastFactorSettings, TransactionStats } from '@/types'
import { cn } from '@/lib/utils'

// Item categorisation

type ItemCategory = 'coffee' | 'cold_drink' | 'food' | 'water' | 'retail' | 'other'

const CATEGORY_COLORS: Record<ItemCategory, string> = {
  coffee: '#D43D3D',
  cold_drink: '#4A9ECC',
  food: '#E58A3C',
  water: '#4A9ECC',
  retail: '#8B7355',
  other: '#888888',
}
function categoriseItem(name: string): ItemCategory {
  const n = name.toLowerCase()
  if (n.includes('still') || n.includes('sparkling') || n.includes('water')) return 'water'
  if (n.includes('iced') || n.includes('cold brew') || n.includes('iced coffee')) return 'cold_drink'
  if (n.includes('matcha') && n.includes('iced')) return 'cold_drink'
  if (
    n.includes('flat white') || n.includes('long white') || n.includes('cappuccino') ||
    n.includes('cortado') || n.includes('espresso') || n.includes('americano') ||
    n.includes('black coffee') || n.includes('mocha') || n.includes('hot choc') ||
    n.includes('latte') || n.includes('pour over') || n.includes('red espresso') ||
    n.includes('matcha')
  ) return 'coffee'
  if (
    n.includes('muffin') || n.includes('croissant') || n.includes('brownie') ||
    n.includes('cookie') || n.includes('cake') || n.includes('sandwich') ||
    n.includes('crunch') || n.includes('lemon') || n.includes('banana') ||
    n.includes('simple square') || n.includes('poppyseed')
  ) return 'food'
  if (n.includes('250g') || n.includes('750g') || n.includes('blend')) return 'retail'
  return 'other'
}

function getItemColor(name: string): string {
  const n = name.toLowerCase()
  // Each item gets a distinct color
  if (n.includes('long white')) return '#D43D3D'
  if (n.includes('flat white') && !n.includes('honey')) return '#E06040'
  if (n.includes('flat white') && n.includes('honey')) return '#D4A43D'
  if (n.includes('black coffee')) return '#A0522D'
  if (n.includes('cortado')) return '#CC7744'
  if (n.includes('espresso')) return '#8B4513'
  if (n.includes('mocha')) return '#6B3A2A'
  if (n.includes('hot choc')) return '#8B6B47'
  if (n.includes('pour over')) return '#B8860B'
  if (n.includes('red espresso')) return '#C62828'
  if (n.includes('muffin') || n.includes('banana')) return '#E58A3C'
  if (n.includes('croissant')) return '#D4A43D'
  if (n.includes('brownie')) return '#7B5B3A'
  if (n.includes('cake')) return '#C4853A'
  if (n.includes('cookie') || n.includes('crunch') || n.includes('simple square')) return '#D4A43D'
  if (n.includes('sandwich')) return '#7CB87A'
  if (n.includes('lemon') || n.includes('poppyseed')) return '#E5C43C'
  if (n.includes('still') || n.includes('water')) return '#5BB8E8'
  if (n.includes('sparkling')) return '#4A9ECC'
  if (n.includes('iced') || n.includes('cold brew')) return '#4A9ECC'
  if (n.includes('matcha') && n.includes('iced')) return '#3D9ECE'
  if (n.includes('matcha')) return '#7CB87A'
  return CATEGORY_COLORS[categoriseItem(name)]
}

function getItemIcon(name: string) {
  const n = name.toLowerCase()
  // Specific icons per item type
  if (n.includes('muffin') || n.includes('banana')) return CakeSlice
  if (n.includes('croissant')) return Croissant
  if (n.includes('brownie') || n.includes('cake')) return CakeSlice
  if (n.includes('cookie') || n.includes('crunch') || n.includes('simple square')) return Cookie
  if (n.includes('sandwich')) return Sandwich
  if (n.includes('lemon') || n.includes('poppyseed')) return CakeSlice
  if (n.includes('still') || n.includes('sparkling') || n.includes('water')) return GlassWater
  if (n.includes('iced') || n.includes('cold brew')) return Snowflake
  if (n.includes('matcha')) return Leaf
  if (n.includes('250g') || n.includes('750g')) return ShoppingBag
  if (categoriseItem(name) === 'coffee') return Coffee
  return UtensilsCrossed
}

function formatZAR(amount: number) {
  return `R${amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function getDayLabel(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'TMRW'
  return date.toLocaleDateString('en-ZA', { weekday: 'short' }).toUpperCase()
}

// Circular gauge

function CircularGauge({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, Math.abs(value)))
  const offset = circumference - (pct / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2A2A2A" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

// Sub-components

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; accent: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-text text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-[#555555] text-xs mt-1">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}18` }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ForecastStatusCard({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-[#111111]">
          <AlertTriangle className="h-6 w-6 text-[#777777]" />
        </div>
        <h2 className="mb-1 text-base font-semibold text-text">{title}</h2>
        <p className="max-w-md text-sm text-muted">{message}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  )
}

function WeatherCard({ signals, locationLabel }: { signals: Forecast['signals']; locationLabel: string }) {
  const { weather, loadSheddingStage } = signals
  const condition = weather.condition.toLowerCase()
  const WeatherIcon = condition.includes('storm')
    ? CloudLightning
    : condition.includes('rain')
      ? CloudRain
      : condition.includes('cloud')
        ? CloudSun
        : Sun

  return (
    <Card className="bg-gradient-to-br from-[#1A2030] to-surface border-[#2A3048]">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-end gap-3">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4A9ECC]/10">
                <WeatherIcon className="h-7 w-7 text-[#4A9ECC]" />
              </div>
              <div>
                <span className="text-4xl font-bold text-text">{weather.temp}&deg;</span>
                <p className="text-[#AAB8CC] text-sm">{weather.condition}</p>
              </div>
            </div>
          </div>
          {loadSheddingStage > 0 && (
            <div className="bg-guava-yellow/10 border border-guava-yellow/20 rounded-lg px-2.5 py-2 text-center">
              <Zap className="w-4 h-4 text-guava-yellow mx-auto mb-0.5" />
              <p className="text-guava-yellow text-xs font-bold">Stage {loadSheddingStage}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-[#2A3048]">
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-[#4A9ECC]" />
            <span className="text-muted text-xs">{weather.humidity}% humidity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted text-xs">{locationLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const FORECAST_FACTOR_ORDER = ['weather', 'loadShedding', 'holiday', 'payday', 'events', 'learning']

const FACTOR_SECTIONS: Record<string, keyof ForecastFactorSettings> = {
  weather: 'weather',
  loadShedding: 'loadShedding',
  holiday: 'holiday',
  payday: 'payday',
  events: 'events',
  learning: 'learning',
}

function formatPlan(plan?: string) {
  if (!plan) return ''
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

function ImpactFactorsCard({ forecast }: { forecast: Forecast }) {
  const { signals } = forecast
  const colors: Record<string, string> = {
    weather: '#4A9ECC',
    loadShedding: '#EF476F',
    holiday: '#FFD166',
    payday: '#4DA63B',
    events: '#9B59B6',
    learning: '#FF8A3D',
  }
  const fallbackFactors: NonNullable<Forecast['factors']> = [
    {
      key: 'weather',
      label: 'Weather',
      active: signals.weather.temp > 27 || signals.weather.temp < 18 || signals.weather.condition.toLowerCase().includes('rain'),
      adjustmentPct: null,
      effect: signals.weather.temp > 27
        ? '+30% cold drinks, -10% coffee'
        : signals.weather.temp < 18
          ? '+15% coffee, -20% cold drinks'
          : signals.weather.condition.toLowerCase().includes('rain')
            ? '-10%'
            : 'no effect',
      reason: signals.weather.condition,
    },
    {
      key: 'loadShedding',
      label: 'Load shedding',
      active: signals.loadSheddingStage > 0,
      adjustmentPct: signals.loadSheddingStage >= 5 ? -40 : signals.loadSheddingStage >= 3 ? -22 : signals.loadSheddingStage > 0 ? -8 : 0,
      effect: signals.loadSheddingStage > 0 ? `Stage ${signals.loadSheddingStage}` : 'no effect',
      reason: signals.loadSheddingStage > 0 ? `stage ${signals.loadSheddingStage}` : '',
    },
    {
      key: 'holiday',
      label: 'Holiday',
      active: signals.isPublicHoliday || signals.isSchoolHoliday,
      adjustmentPct: signals.isPublicHoliday && signals.isSchoolHoliday ? 20 : signals.isPublicHoliday ? 15 : signals.isSchoolHoliday ? 8 : 0,
      effect: signals.isPublicHoliday || signals.isSchoolHoliday ? 'calendar adjustment' : 'no effect',
      reason: signals.isPublicHoliday ? 'public holiday' : signals.isSchoolHoliday ? 'school holiday' : '',
    },
    {
      key: 'payday',
      label: 'Payday',
      active: signals.isPayday,
      adjustmentPct: signals.isPayday ? 20 : 0,
      effect: signals.isPayday ? '+20%' : 'no effect',
      reason: signals.isPayday ? 'payday window' : '',
    },
    {
      key: 'events',
      label: 'Events',
      active: (signals.events?.length ?? 0) > 0,
      adjustmentPct: signals.events?.[0]?.impactPct ?? (signals.events?.[0]?.impact === 'high' ? 35 : signals.events?.[0]?.impact === 'medium' ? 20 : signals.events?.[0]?.impact === 'low' ? 10 : 0),
      effect: (signals.events?.length ?? 0) > 0 ? signals.events?.[0]?.name : 'no effect',
      reason: signals.events?.[0]?.name,
    },
    {
      key: 'learning',
      label: 'Learning correction',
      active: false,
      adjustmentPct: 0,
      effect: 'no effect',
      reason: 'not enough history yet',
    },
  ]
  const compactImpact = (factor: NonNullable<Forecast['factors']>[number]) => {
    if (typeof factor.adjustmentPct === 'number') {
      const rounded = Number(factor.adjustmentPct.toFixed(1))
      return `${rounded > 0 ? '+' : ''}${rounded}%`
    }
    return factor.effect && factor.effect !== 'no effect' ? 'varies' : 'active'
  }
  const sourceFactors = forecast.factors && forecast.factors.length > 0 ? forecast.factors : fallbackFactors
  const sourceByKey = new Map(sourceFactors.map((factor) => [factor.key, factor]))
  const orderedFactors = FORECAST_FACTOR_ORDER
    .map((key) => sourceByKey.get(key))
    .filter(Boolean) as NonNullable<Forecast['factors']>
  const entitlementsByKey = new Map((forecast.factorEntitlements?.factors ?? []).map((factor) => [factor.key, factor]))
  const displayFactors = (orderedFactors.length > 0 ? orderedFactors : sourceFactors).map((factor) => {
    const entitlement = entitlementsByKey.get(factor.key)
    const locked = entitlement ? !entitlement.unlocked : false
    const section = FACTOR_SECTIONS[factor.key]
    const sectionSettings = section ? forecast.factorSettings?.[section] : undefined
    const configuredOn = sectionSettings && 'enabled' in sectionSettings ? sectionSettings.enabled !== false : true
    const off = !locked && !configuredOn
    const active = Boolean(factor.active && !locked && !off)
    const rawPct = Math.abs(factor.adjustmentPct ?? (active ? 25 : 0))
    const stateLabel = locked ? formatPlan(entitlement?.requiredPlan) : off ? 'Off' : active ? compactImpact(factor) : '0%'

    return {
      key: factor.key,
      label: factor.label,
      pct: active ? Math.min(100, Math.max(35, rawPct * 2.5)) : 0,
      impact: stateLabel,
      detail: locked
        ? `Unlock on ${formatPlan(entitlement?.requiredPlan)}`
        : off
          ? 'Disabled in factor rules'
          : active
            ? factor.effect || factor.reason || 'Applied to this forecast'
            : factor.reason || 'No effect on this forecast',
      color: colors[factor.key] ?? '#9B59B6',
      active,
      locked,
      off,
    }
  })
  const activeCount = displayFactors.filter((factor) => factor.active).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Sales Impact Factors</CardTitle>
          <span className="text-[#555555] text-xs">{activeCount} active</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-3">
          {displayFactors.map((f) => (
            <div key={f.key} className="flex flex-col items-center text-center" title={f.detail || f.label}>
              <div className="relative mb-1.5">
                <CircularGauge value={f.pct} color={f.active ? f.color : '#2A2A2A'} size={48} />
                <span
                  className="absolute inset-0 flex items-center justify-center px-1 text-[10px] font-bold leading-none"
                  style={{ color: f.active ? f.color : f.locked || f.off ? '#777777' : '#555555' }}
                >
                  {f.impact}
                </span>
              </div>
              <span className={cn('max-w-full text-[10px] leading-tight', f.locked || f.off ? 'text-[#666666]' : 'text-muted')}>
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ItemCard({ itemName, predictedQty }: { itemName: string; predictedQty: number }) {
  const color = getItemColor(itemName)
  const Icon = getItemIcon(itemName)

  return (
    <div className="bg-[#111111] border border-border rounded-xl p-4 text-center hover:border-[#3A3A3A] transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color }}>
        {predictedQty}
      </div>
      <div className="text-[#555555] text-[11px] leading-tight truncate" title={itemName}>
        {itemName.replace(/\s*\(.*?\)\s*/g, '')}
      </div>
    </div>
  )
}

function TimePeriodRow({
  period,
  maxQty,
}: {
  period: { label: string; timeRange: string; temp: number; items: { name: string; qty: number }[]; totalQty: number }
  maxQty: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[#1F1F1F] last:border-0">
      <button
        className="w-full flex items-center gap-3 py-3 px-1 hover:bg-white/[0.02] transition-colors rounded-lg text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Clock className="w-3.5 h-3.5 text-[#555555] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text text-sm font-medium">{period.label}</span>
            <span className="text-[#555555] text-xs">{period.timeRange}</span>
            <span className="text-[#555555] text-xs">{period.temp}&deg;</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {period.items.slice(0, 7).map((item) => {
            const color = getItemColor(item.name)
            const Icon = getItemIcon(item.name)
            return (
              <span
                key={item.name}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
                style={{ color }}
              >
                <Icon className="w-3 h-3" style={{ color }} />
                {item.qty}
              </span>
            )
          })}
          <span className="text-text text-xs w-8 text-right font-bold ml-1">{period.totalQty}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[#555555]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#555555]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-3 space-y-2">
          {period.items.map((item) => {
            const color = getItemColor(item.name)
            const pct = Math.round((item.qty / maxQty) * 100)
            return (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-muted text-xs w-32 truncate">{item.name.replace(/\s*\(.*?\)\s*/g, '')}</span>
                <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="text-xs font-semibold tabular-nums w-6 text-right" style={{ color }}>{item.qty}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Build time periods from forecast data

function buildTimePeriods(forecast: Forecast) {
  // Include ALL forecast items, not just the top 6
  const allItems = forecast.items
  if (allItems.length === 0) return []

  // Distribute quantities across time periods with category-aware weighting
  // Coffee dominates morning, food peaks mid-morning, cold drinks peak afternoon
  const periods = [
    { label: 'Pre-Dawn', timeRange: '05:00 - 06:00', temp: Math.max(forecast.signals.weather.temp - 5, 14), pctByCategory: { coffee: 0.04, food: 0.01, cold_drink: 0.01, water: 0.01, retail: 0.02, other: 0.02 } },
    { label: 'Early Morning', timeRange: '06:00 - 08:00', temp: forecast.signals.weather.temp - 3, pctByCategory: { coffee: 0.18, food: 0.10, cold_drink: 0.08, water: 0.08, retail: 0.10, other: 0.10 } },
    { label: 'Morning Rush', timeRange: '08:00 - 10:00', temp: forecast.signals.weather.temp - 1, pctByCategory: { coffee: 0.32, food: 0.35, cold_drink: 0.22, water: 0.25, retail: 0.30, other: 0.25 } },
    { label: 'Late Morning', timeRange: '10:00 - 12:00', temp: forecast.signals.weather.temp, pctByCategory: { coffee: 0.22, food: 0.28, cold_drink: 0.25, water: 0.28, retail: 0.25, other: 0.25 } },
    { label: 'Afternoon', timeRange: '12:00 - 15:00', temp: forecast.signals.weather.temp, pctByCategory: { coffee: 0.16, food: 0.20, cold_drink: 0.32, water: 0.28, retail: 0.25, other: 0.25 } },
    { label: 'Evening Wind-Down', timeRange: '15:00 - 17:00', temp: forecast.signals.weather.temp - 2, pctByCategory: { coffee: 0.08, food: 0.06, cold_drink: 0.12, water: 0.10, retail: 0.08, other: 0.13 } },
  ]

  return periods.map((p) => {
    const items = allItems.map((item) => {
      const cat = categoriseItem(item.itemName)
      const pct = p.pctByCategory[cat] || 0.1
      return {
        name: item.itemName,
        qty: Math.round(item.predictedQty * pct),
      }
    }).filter(i => i.qty > 0)
      .sort((a, b) => b.qty - a.qty)

    return {
      label: p.label,
      timeRange: p.timeRange,
      temp: Math.round(p.temp),
      totalQty: items.reduce((s, i) => s + i.qty, 0),
      items,
    }
  })
}

// Main dashboard

export default function Dashboard() {
  const [fallbackForecast, setFallbackForecast] = useState<Forecast | null>(null)
  const [weekForecasts, setWeekForecasts] = useState<Forecast[]>([])
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [locationLabel, setLocationLabel] = useState('Cafe location')
  const [forecastLoadFailed, setForecastLoadFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasData, setHasData] = useState(true)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setForecastLoadFailed(false)
      try {
        const [todayRes, weekRes, statsRes, cafeRes] = await Promise.all([
          api.get('/forecasts/today')
            .then((res) => ({ res, failed: false }))
            .catch(() => ({ res: null, failed: true })),
          api.get('/forecasts/week')
            .then((res) => ({ res, failed: false }))
            .catch(() => ({ res: null, failed: true })),
          api.get('/transactions/stats').catch(() => null),
          api.get('/cafe/me').catch(() => null),
        ])

        if (cancelled) return

        const loadedWeek = Array.isArray(weekRes.res?.data?.forecasts) ? weekRes.res.data.forecasts : []
        const loadedFallback = loadedWeek.length > 0 ? null : todayRes.res?.data?.forecast || null
        const loadedStats = statsRes?.data?.stats || null
        const cafe = cafeRes?.data?.cafe
        const nextLocationLabel = [cafe?.location?.address, cafe?.location?.city].filter(Boolean).join(', ')

        setWeekForecasts(loadedWeek)
        setFallbackForecast(loadedFallback)
        setForecastLoadFailed(todayRes.failed && weekRes.failed)
        setSelectedDayIdx((current) => (
          loadedWeek.length === 0 ? 0 : Math.min(current, loadedWeek.length - 1)
        ))
        setStats(loadedStats)
        setLocationLabel(nextLocationLabel || cafe?.name || 'Cafe location')

        const forecastHasItems = (loadedWeek[0]?.items.length || loadedFallback?.items.length || 0) > 0
        setHasData((loadedStats?.totalTransactions || 0) > 0 || forecastHasItems)
      } catch {
        if (!cancelled) {
          setForecastLoadFailed(true)
          setHasData(false)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const activeForecast = weekForecasts[selectedDayIdx] || fallbackForecast
  const activeForecastHasItems = (activeForecast?.items.length ?? 0) > 0
  const topItem = activeForecast?.items.length
    ? activeForecast.items.reduce((a, b) => a.predictedQty > b.predictedQty ? a : b)
    : undefined
  const totalItems = activeForecast?.items.reduce((sum, i) => sum + i.predictedQty, 0) ?? 0
  const timePeriods = activeForecast ? buildTimePeriods(activeForecast) : []
  const peakPeriod = timePeriods.length > 0 ? timePeriods.reduce((a, b) => a.totalQty > b.totalQty ? a : b) : null
  const maxTimePeriodQty = Math.max(...timePeriods.map(p => p.totalQty), 1)

  const kpis = [
    {
      label: 'Forecast Revenue',
      value: activeForecast ? formatZAR(activeForecast.totalPredictedRevenue) : '-',
      sub: stats ? `Avg: ${formatZAR(stats.avgDailyRevenue)}/day` : undefined,
      icon: TrendingUp,
      accent: '#4DA63B',
    },
    {
      label: 'Peak Period',
      value: peakPeriod?.label ?? '-',
      sub: peakPeriod ? `${peakPeriod.timeRange} - ${peakPeriod.totalQty} items` : undefined,
      icon: Clock,
      accent: '#FFD166',
    },
    {
      label: 'Top Item',
      value: topItem ? topItem.itemName.replace(/\s*\(.*?\)\s*/g, '') : '-',
      sub: topItem ? `${topItem.predictedQty} units predicted` : undefined,
      icon: Crown,
      accent: '#D43D3D',
    },
    {
      label: 'Total Items',
      value: totalItems.toLocaleString(),
      sub: stats ? `${stats.totalTransactions.toLocaleString()} historical transactions` : undefined,
      icon: Zap,
      accent: '#4A9ECC',
    },
  ]

  // Empty state
  if (!isLoading && !hasData) {
    return (
      <AppLayout title="Today">
        <div className="flex flex-col items-center justify-center min-h-100 text-center">
          <div className="w-14 h-14 rounded-xl bg-surface border border-border flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#555555]" />
          </div>
          <h2 className="text-text text-lg font-semibold mb-2">No data yet</h2>
          <p className="text-[#555555] text-sm mb-6 max-w-xs">Upload your transaction data to start generating forecasts.</p>
          <Link to="/data-health">
            <Button><Upload className="w-4 h-4" />Upload Sales Data</Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Today">
      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5 pb-5"><Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-7 w-32 mb-2" /><Skeleton className="h-3 w-20" /></CardContent></Card>
            ))
          : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Day Selector */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {weekForecasts.length > 0
          ? weekForecasts.map((wf, idx) => {
              const d = new Date(wf.date)
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={cn(
                    'flex flex-col items-center px-3.5 py-2 rounded-lg border text-center shrink-0 transition-colors min-w-16',
                    selectedDayIdx === idx
                      ? 'bg-guava-green/10 border-guava-green/40 text-guava-green'
                      : 'bg-[#111111] border-border text-muted hover:text-text hover:border-[#3A3A3A]'
                  )}
                >
                  <span className="text-xs font-bold tracking-wide">{getDayLabel(d)}</span>
                  <span className="text-[10px] mt-0.5 opacity-70">{formatDate(d)}</span>
                </button>
              )
            })
          : isLoading
            ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="w-16 h-14 rounded-lg shrink-0" />)
            : null}
      </div>

      {!isLoading && !activeForecast && (
        <ForecastStatusCard
          title={forecastLoadFailed ? 'Forecast unavailable' : 'No forecast ready yet'}
          message={
            forecastLoadFailed
              ? 'Your sales data is available, but the forecast service did not return a usable forecast. Try again, and check the backend logs if it keeps happening.'
              : 'Your sales data is available, but there is not enough matched history yet to build today\'s item forecast.'
          }
          action={forecastLoadFailed ? <Button onClick={reload}>Try again</Button> : undefined}
        />
      )}

      {/* Predicted Output */}
      {!isLoading && activeForecast && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text text-sm font-semibold uppercase tracking-wider">
              Predicted Output
            </h2>
            <div className="flex items-center gap-3">
              {activeForecast.totalPredictedRevenue > 0 && (
                <span className="text-guava-green text-sm font-bold">
                  Target {formatZAR(activeForecast.totalPredictedRevenue)}
                </span>
              )}
              {activeForecast.accuracy && (
                <Badge variant="success" className="text-xs">
                  {activeForecast.accuracy}% accuracy
                </Badge>
              )}
            </div>
          </div>
          {activeForecastHasItems ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {activeForecast.items.map((item) => (
                <ItemCard key={item.itemName} itemName={item.itemName} predictedQty={item.predictedQty} />
              ))}
            </div>
          ) : (
            <ForecastStatusCard
              title="No item predictions for this day"
              message="Guava has transaction history, but not enough matching day-of-week item history for this selected day yet. Uploading more POS data will improve this."
            />
          )}

          {/* Signals strip */}
          <div className="flex flex-wrap gap-2 mt-4">
            {activeForecast.signals.isPayday && (
              <div className="flex items-center gap-1.5 bg-guava-green/10 border border-guava-green/20 rounded-md px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-guava-green" />
                <span className="text-guava-green text-xs font-medium">Payday</span>
              </div>
            )}
            {activeForecast.signals.isPublicHoliday && (
              <div className="flex items-center gap-1.5 bg-guava-red/10 border border-guava-red/20 rounded-md px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-guava-red" />
                <span className="text-guava-red text-xs font-medium">Public Holiday</span>
              </div>
            )}
            {activeForecast.signals.events && activeForecast.signals.events.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#9B59B6]/10 border border-[#9B59B6]/20 rounded-md px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9B59B6]" />
                <span className="text-[#9B59B6] text-xs font-medium">
                  {activeForecast.signals.events[0].name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      )}

      {/* Bottom Grid: Weather + Factors | Time Breakdown */}
      {(isLoading || activeForecast) && (
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </>
          ) : activeForecast ? (
            <>
              <WeatherCard signals={activeForecast.signals} locationLabel={locationLabel} />
              <ImpactFactorsCard forecast={activeForecast} />
            </>
          ) : null}
        </div>

        {/* Right column: Time of Day */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Time-of-Day Breakdown</CardTitle>
              <span className="text-[#555555] text-xs">Click to expand</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : timePeriods.length > 0 ? (
              <div>
                {timePeriods.map((period) => (
                  <TimePeriodRow key={period.label} period={period} maxQty={maxTimePeriodQty} />
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted">No time-of-day item forecast available for this day.</p>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </AppLayout>
  )
}
