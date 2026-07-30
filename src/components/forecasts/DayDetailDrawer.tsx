import { useEffect, useRef } from 'react'
import { X, Coffee, Droplets, UtensilsCrossed, Waves, Sparkles } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ModifierBreakdown } from './ModifierBreakdown'
import type { Forecast } from '@/types'
import { forecastDateKey, parseDateOnly } from '@/lib/date'

function getDayLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseDateOnly(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return target.toLocaleDateString('en-ZA', { weekday: 'long' })
}

function fullDate(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Inventory keyword rollup
const COFFEE_KEYWORDS = ['flat white', 'cappuccino', 'long white', 'espresso', 'cortado', 'americano', 'mocha', 'latte', 'pour over']
const COLD_KEYWORDS = ['iced', 'cold brew']
const FOOD_KEYWORDS = ['muffin', 'brownie', 'cookie', 'sandwich', 'cake', 'croissant']
const WATER_KEYWORDS = ['water', 'still', 'sparkling']
const SHOW_INVENTORY_ROLLUP = false

function matchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase()
  return keywords.some((k) => lower.includes(k))
}

function hasMatchedActuals(forecast: Forecast): boolean {
  return Boolean(
    forecast.actualsUpdatedAt ||
    (forecast.actualTransactionCount != null && forecast.actualTransactionCount > 0) ||
    (forecast.accuracy != null && forecast.items.some((item) => item.actualQty != null))
  )
}

interface InventoryRollup {
  coffee: number
  cold: number
  food: number
  water: number
}

function computeInventory(items: Forecast['items']): InventoryRollup {
  const rollup: InventoryRollup = { coffee: 0, cold: 0, food: 0, water: 0 }
  for (const item of items) {
    const stock = item.suggestedStock
    if (stock == null) continue
    if (matchesAny(item.itemName, COFFEE_KEYWORDS)) rollup.coffee += stock
    else if (matchesAny(item.itemName, COLD_KEYWORDS)) rollup.cold += stock
    else if (matchesAny(item.itemName, FOOD_KEYWORDS)) rollup.food += stock
    else if (matchesAny(item.itemName, WATER_KEYWORDS)) rollup.water += stock
  }
  return rollup
}

interface Props {
  forecast: Forecast
  weekAvg: number
  onClose: () => void
}

export function DayDetailDrawer({ forecast, weekAvg, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { items, totalPredictedRevenue } = forecast
  const calendarDate = forecastDateKey(forecast)
  const isClosed = forecast.availability?.status === 'closed'

  // Determine if this is a past day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const forecastDate = parseDateOnly(calendarDate)
  forecastDate.setHours(0, 0, 0, 0)
  const isPast = forecastDate < today

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()

    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      previousFocus?.focus()
    }
  }, [onClose])

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const delta = weekAvg > 0 ? ((totalPredictedRevenue - weekAvg) / weekAvg) * 100 : 0
  const isNeutral = Math.abs(delta) <= 5
  const deltaColor = isNeutral ? 'text-muted' : delta > 0 ? 'text-guava-green' : 'text-guava-red'
  const deltaPrefix = delta > 0 ? '+' : ''

  // ── Past (review) mode helpers ─────────────────────────────────────────────
  const hasActuals = hasMatchedActuals(forecast)
  const actualRevenue = hasActuals && forecast.actualRevenue != null ? forecast.actualRevenue : null

  const revDelta =
    actualRevenue != null && totalPredictedRevenue > 0
      ? ((actualRevenue - totalPredictedRevenue) / totalPredictedRevenue) * 100
      : null

  // Items sorted by absolute delta desc for review mode
  const sortedForReview = [...items]
    .map((it) => {
      const pct =
        hasActuals && it.actualQty != null && it.predictedQty > 0
          ? Math.abs((it.actualQty - it.predictedQty) / it.predictedQty)
          : 0
      return { ...it, absDeltaPct: pct }
    })
    .sort((a, b) => b.absDeltaPct - a.absDeltaPct)

  // Worst-miss items: >15% off
  const worstMiss = sortedForReview.filter(
    (it) => hasActuals && it.actualQty != null && it.absDeltaPct > 0.15
  ).slice(0, 3)

  // ── Plan mode helpers ──────────────────────────────────────────────────────
  const sortedItems = [...items].sort((a, b) => b.predictedQty - a.predictedQty)
  const inventory = computeInventory(items)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={dialogRef}
        className="fixed right-0 top-0 h-full bg-surface border-l border-border z-50 overflow-y-auto
                   w-full sm:w-130"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-forecast-dialog-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <p id="day-forecast-dialog-title" className="text-text font-semibold text-base">
              {isClosed ? 'Closed day' : isPast ? 'Day review' : 'Day forecast'} — {getDayLabel(calendarDate)}
            </p>
            <p className="text-muted text-xs mt-0.5">{fullDate(calendarDate)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 -mr-1 shrink-0"
            aria-label="Close forecast details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Revenue tile */}
          <div className="rounded-lg bg-[#111111] border border-border p-4">
            {isClosed ? (
              <>
                <p className="text-guava-red text-xs font-semibold uppercase tracking-wide">Closed</p>
                <p className="mt-2 text-text text-lg font-semibold">No trading forecast</p>
                <p className="mt-1 text-sm text-muted">
                  {forecast.availability?.reason || 'This café is closed for the day.'}
                </p>
              </>
            ) : isPast && hasActuals && actualRevenue != null ? (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-muted text-xs mb-1">Predicted revenue</p>
                    <p className="text-muted text-2xl font-bold">
                      R {totalPredictedRevenue.toLocaleString('en-ZA')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted text-xs mb-1">Actual revenue</p>
                    <p className="text-text text-2xl font-bold">
                      R {actualRevenue.toLocaleString('en-ZA')}
                    </p>
                  </div>
                </div>
                {revDelta !== null && (
                  <p
                    className={`text-sm mt-2 ${
                      Math.abs(revDelta) <= 5
                        ? 'text-guava-green'
                        : Math.abs(revDelta) <= 15
                        ? 'text-guava-yellow'
                        : 'text-guava-red'
                    }`}
                  >
                    {revDelta >= 0 ? '+' : ''}{revDelta.toFixed(0)}% vs predicted
                  </p>
                )}
              </>
            ) : isPast && !hasActuals ? (
              <>
                <p className="text-muted text-xs mb-1">Predicted revenue</p>
                <p className="text-text text-3xl font-bold">
                  R {totalPredictedRevenue.toLocaleString('en-ZA')}
                </p>
                <p className="text-muted text-sm mt-2">
                  Awaiting matched sales data for this day.
                </p>
              </>
            ) : isPast && hasActuals ? (
              <>
                <p className="text-muted text-xs mb-1">Predicted revenue</p>
                <p className="text-text text-3xl font-bold">
                  R {totalPredictedRevenue.toLocaleString('en-ZA')}
                </p>
                <p className="text-muted text-sm mt-2">
                  Actual item counts are available, but actual revenue was not stored for this day.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted text-xs mb-1">Predicted revenue</p>
                <p className="text-text text-3xl font-bold">
                  R {totalPredictedRevenue.toLocaleString('en-ZA')}
                </p>
                {weekAvg > 0 && (
                  <p className={`text-sm mt-1 ${deltaColor}`}>
                    {isNeutral ? 'On par with' : `${deltaPrefix}${delta.toFixed(0)}% vs`} weekly average
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── PAST: What we missed ────────────────────────────────────────── */}
          {!isClosed && isPast && worstMiss.length > 0 && (
            <div>
              <p className="text-text text-xs font-semibold uppercase tracking-wider mb-3">
                What we missed
              </p>
              <div className="space-y-2">
                {worstMiss.map((item) => {
                  const diff = (item.actualQty ?? 0) - item.predictedQty
                  const direction = diff > 0 ? 'over by' : 'under by'
                  const absDiff = Math.abs(diff)
                  return (
                    <div key={item.itemName} className="text-xs text-muted">
                      <span className="text-text">{item.itemName}</span>
                      {' — '}predicted {item.predictedQty}, actual {item.actualQty},{' '}
                      <span className={diff > 0 ? 'text-guava-green' : 'text-guava-red'}>
                        {direction} {absDiff} units
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── FUTURE: Why this prediction ────────────────────────────────── */}
          {!isClosed && !isPast && (
            <div>
              <p className="text-text text-xs font-semibold uppercase tracking-wider mb-3">
                Why this prediction?
              </p>
              <ModifierBreakdown factors={forecast.factors} />
            </div>
          )}

          {!isClosed && <Separator className="bg-border" />}

          {/* Item breakdown */}
          {!isClosed && <div>
            <p className="text-text text-xs font-semibold uppercase tracking-wider mb-3">
              Item breakdown
            </p>

            {isPast ? (
              // Review mode: Item · Predicted · Actual · Δ%
              <div className="space-y-0">
                <div className="grid grid-cols-4 pb-2 border-b border-border">
                  <span className="text-muted text-[10px] uppercase tracking-wider">Item</span>
                  <span className="text-muted text-[10px] uppercase tracking-wider text-right">Predicted</span>
                  <span className="text-muted text-[10px] uppercase tracking-wider text-right">Actual</span>
                  <span className="text-muted text-[10px] uppercase tracking-wider text-right">Δ %</span>
                </div>
                {(hasActuals ? sortedForReview : sortedItems).map((item) => {
                  const pct =
                    hasActuals && item.actualQty != null && item.predictedQty > 0
                      ? ((item.actualQty - item.predictedQty) / item.predictedQty) * 100
                      : null
                  const pctColor =
                    pct == null
                      ? 'text-muted'
                      : Math.abs(pct) <= 5
                      ? 'text-guava-green'
                      : Math.abs(pct) <= 15
                      ? 'text-guava-yellow'
                      : 'text-guava-red'
                  return (
                    <div
                      key={item.itemName}
                      className="grid grid-cols-4 py-2 border-b border-[#1F1F1F] last:border-0"
                    >
                      <span className="text-text text-xs truncate pr-1">{item.itemName}</span>
                      <span className="text-muted text-xs text-right">{item.predictedQty}</span>
                      <span className="text-muted text-xs text-right">
                        {hasActuals && item.actualQty != null ? item.actualQty : '---'}
                      </span>
                      <span className={`text-xs text-right ${pctColor}`}>
                        {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : '---'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Plan mode: Item · Predicted · Suggested stock · Revenue est.
              <div className="space-y-0">
                <div className="grid grid-cols-3 pb-2 border-b border-border">
                  <span className="text-muted text-[10px] uppercase tracking-wider">Item</span>
                  <span className="text-muted text-[10px] uppercase tracking-wider text-right">Predicted</span>
                  <span className="text-muted text-[10px] uppercase tracking-wider text-right">Suggested stock</span>
                </div>
                {sortedItems.map((item) => {
                  return (
                    <div
                      key={item.itemName}
                      className="grid grid-cols-3 py-2 border-b border-[#1F1F1F] last:border-0"
                    >
                      <span className="text-text text-xs truncate pr-1">{item.itemName}</span>
                      <span className="text-muted text-xs text-right">{item.predictedQty}</span>
                      <span className="text-muted text-xs text-right">{item.suggestedStock ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>}

          {/* ── FUTURE only: Inventory rollup + AI insight ─────────────────── */}
          {!isClosed && !isPast && SHOW_INVENTORY_ROLLUP && (
            <>
              <Separator className="bg-border" />

              <div>
                <p className="text-text text-xs font-semibold uppercase tracking-wider mb-3">
                  Rough inventory hint
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#111111] border border-border p-3 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-guava-red shrink-0" />
                    <div>
                      <p className="text-text text-sm font-semibold">≈ {inventory.coffee}</p>
                      <p className="text-muted text-[10px]">coffee drinks</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-border p-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-guava-green shrink-0" />
                    <div>
                      <p className="text-text text-sm font-semibold">≈ {inventory.cold}</p>
                      <p className="text-muted text-[10px]">cold drinks</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-border p-3 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-guava-yellow shrink-0" />
                    <div>
                      <p className="text-text text-sm font-semibold">≈ {inventory.food}</p>
                      <p className="text-muted text-[10px]">food items</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-border p-3 flex items-center gap-2">
                    <Waves className="w-4 h-4 text-muted shrink-0" />
                    <div>
                      <p className="text-text text-sm font-semibold">≈ {inventory.water}</p>
                      <p className="text-muted text-[10px]">waters</p>
                    </div>
                  </div>
                </div>
                <p className="text-muted text-[10px] mt-3 leading-relaxed">
                  Rollup uses only suggested stock values returned by the forecast service.
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="rounded-lg bg-[#111111] border border-border p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-guava-red shrink-0 mt-0.5" />
                <p className="text-muted text-xs leading-relaxed">
                  AI insights load globally - see{' '}
                  <span className="text-guava-red">Ask Guava</span> for the full list powered by Claude.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
