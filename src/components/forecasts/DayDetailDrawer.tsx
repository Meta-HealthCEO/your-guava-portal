import { useEffect } from 'react'
import { X, Coffee, Droplets, UtensilsCrossed, Waves, Sparkles } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ModifierBreakdown } from './ModifierBreakdown'
import type { Forecast } from '@/types'

function getDayLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return target.toLocaleDateString('en-ZA', { weekday: 'long' })
}

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
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

function matchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase()
  return keywords.some((k) => lower.includes(k))
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
    const stock = item.suggestedStock ?? item.predictedQty
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
  const { date, items, signals, totalPredictedRevenue } = forecast

  // Determine if this is a past day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const forecastDate = new Date(date)
  forecastDate.setHours(0, 0, 0, 0)
  const isPast = forecastDate < today

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const delta = weekAvg > 0 ? ((totalPredictedRevenue - weekAvg) / weekAvg) * 100 : 0
  const isNeutral = Math.abs(delta) <= 5
  const deltaColor = isNeutral ? 'text-[#888888]' : delta > 0 ? 'text-[#4DA63B]' : 'text-[#D43D3D]'
  const deltaPrefix = delta > 0 ? '+' : ''

  // ── Past (review) mode helpers ─────────────────────────────────────────────
  const hasActuals = items.some((it) => it.actualQty != null)

  // Actual revenue estimate: sum(actualQty / predictedQty * predictedRevenue)
  // We don't have per-item revenue, so use accuracy proxy if available
  const actualRevenue =
    forecast.accuracy != null
      ? Math.round(totalPredictedRevenue * (forecast.accuracy / 100))
      : null

  const revDelta =
    actualRevenue != null && totalPredictedRevenue > 0
      ? ((actualRevenue - totalPredictedRevenue) / totalPredictedRevenue) * 100
      : null

  // Items sorted by absolute delta desc for review mode
  const sortedForReview = [...items]
    .map((it) => {
      const pct =
        it.actualQty != null && it.predictedQty > 0
          ? Math.abs((it.actualQty - it.predictedQty) / it.predictedQty)
          : 0
      return { ...it, absDeltaPct: pct }
    })
    .sort((a, b) => b.absDeltaPct - a.absDeltaPct)

  // Worst-miss items: >15% off
  const worstMiss = sortedForReview.filter(
    (it) => it.actualQty != null && it.absDeltaPct > 0.15
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
        className="fixed right-0 top-0 h-full bg-[#1A1A1A] border-l border-[#2A2A2A] z-50 overflow-y-auto
                   w-full sm:w-[520px]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-[#2A2A2A] px-5 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <p className="text-[#F0F0F0] font-semibold text-base">
              {isPast ? 'Day review' : 'Day forecast'} — {getDayLabel(date)}
            </p>
            <p className="text-[#888888] text-xs mt-0.5">{fullDate(date)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-[#F0F0F0] p-1 -mr-1 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Revenue tile */}
          <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-4">
            {isPast && actualRevenue != null ? (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[#888888] text-xs mb-1">Predicted revenue</p>
                    <p className="text-[#888888] text-2xl font-bold">
                      R {totalPredictedRevenue.toLocaleString('en-ZA')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#888888] text-xs mb-1">Actual (estimated)</p>
                    <p className="text-[#F0F0F0] text-2xl font-bold">
                      R {actualRevenue.toLocaleString('en-ZA')}
                    </p>
                  </div>
                </div>
                {revDelta !== null && (
                  <p
                    className={`text-sm mt-2 ${
                      Math.abs(revDelta) <= 5
                        ? 'text-[#4DA63B]'
                        : Math.abs(revDelta) <= 15
                        ? 'text-[#FFD166]'
                        : 'text-[#D43D3D]'
                    }`}
                  >
                    {revDelta >= 0 ? '+' : ''}{revDelta.toFixed(0)}% vs predicted
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[#888888] text-xs mb-1">Predicted revenue</p>
                <p className="text-[#F0F0F0] text-3xl font-bold">
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
          {isPast && worstMiss.length > 0 && (
            <div>
              <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
                What we missed
              </p>
              <div className="space-y-2">
                {worstMiss.map((item) => {
                  const diff = (item.actualQty ?? 0) - item.predictedQty
                  const direction = diff > 0 ? 'over by' : 'under by'
                  const absDiff = Math.abs(diff)
                  return (
                    <div key={item.itemName} className="text-xs text-[#888888]">
                      <span className="text-[#F0F0F0]">{item.itemName}</span>
                      {' — '}predicted {item.predictedQty}, actual {item.actualQty},{' '}
                      <span className={diff > 0 ? 'text-[#4DA63B]' : 'text-[#D43D3D]'}>
                        {direction} {absDiff} units
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── FUTURE: Why this prediction ────────────────────────────────── */}
          {!isPast && (
            <div>
              <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
                Why this prediction?
              </p>
              <ModifierBreakdown signals={signals} />
            </div>
          )}

          <Separator className="bg-[#2A2A2A]" />

          {/* Item breakdown */}
          <div>
            <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
              Item breakdown
            </p>

            {isPast ? (
              // Review mode: Item · Predicted · Actual · Δ%
              <div className="space-y-0">
                <div className="grid grid-cols-4 pb-2 border-b border-[#2A2A2A]">
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider">Item</span>
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Predicted</span>
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Actual</span>
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Δ %</span>
                </div>
                {(hasActuals ? sortedForReview : sortedItems).map((item) => {
                  const pct =
                    item.actualQty != null && item.predictedQty > 0
                      ? ((item.actualQty - item.predictedQty) / item.predictedQty) * 100
                      : null
                  const pctColor =
                    pct == null
                      ? 'text-[#555555]'
                      : Math.abs(pct) <= 5
                      ? 'text-[#4DA63B]'
                      : Math.abs(pct) <= 15
                      ? 'text-[#FFD166]'
                      : 'text-[#D43D3D]'
                  return (
                    <div
                      key={item.itemName}
                      className="grid grid-cols-4 py-2 border-b border-[#1F1F1F] last:border-0"
                    >
                      <span className="text-[#F0F0F0] text-xs truncate pr-1">{item.itemName}</span>
                      <span className="text-[#888888] text-xs text-right">{item.predictedQty}</span>
                      <span className="text-[#888888] text-xs text-right">
                        {item.actualQty != null ? item.actualQty : '—'}
                      </span>
                      <span className={`text-xs text-right ${pctColor}`}>
                        {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Plan mode: Item · Predicted · Suggested stock · Revenue est.
              <div className="space-y-0">
                <div className="grid grid-cols-3 pb-2 border-b border-[#2A2A2A]">
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider">Item</span>
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Predicted</span>
                  <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Suggested stock</span>
                </div>
                {sortedItems.map((item) => {
                  const stock =
                    item.suggestedStock != null
                      ? item.suggestedStock
                      : Math.ceil(item.predictedQty * 1.1)
                  return (
                    <div
                      key={item.itemName}
                      className="grid grid-cols-3 py-2 border-b border-[#1F1F1F] last:border-0"
                    >
                      <span className="text-[#F0F0F0] text-xs truncate pr-1">{item.itemName}</span>
                      <span className="text-[#888888] text-xs text-right">{item.predictedQty}</span>
                      <span className="text-[#555555] text-xs text-right">{stock}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── FUTURE only: Inventory rollup + AI insight ─────────────────── */}
          {!isPast && (
            <>
              <Separator className="bg-[#2A2A2A]" />

              <div>
                <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
                  Rough inventory hint
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-3 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-[#D43D3D] flex-shrink-0" />
                    <div>
                      <p className="text-[#F0F0F0] text-sm font-semibold">≈ {inventory.coffee}</p>
                      <p className="text-[#555555] text-[10px]">coffee drinks</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#4DA63B] flex-shrink-0" />
                    <div>
                      <p className="text-[#F0F0F0] text-sm font-semibold">≈ {inventory.cold}</p>
                      <p className="text-[#555555] text-[10px]">cold drinks</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-3 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-[#FFD166] flex-shrink-0" />
                    <div>
                      <p className="text-[#F0F0F0] text-sm font-semibold">≈ {inventory.food}</p>
                      <p className="text-[#555555] text-[10px]">food items</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-3 flex items-center gap-2">
                    <Waves className="w-4 h-4 text-[#888888] flex-shrink-0" />
                    <div>
                      <p className="text-[#F0F0F0] text-sm font-semibold">≈ {inventory.water}</p>
                      <p className="text-[#555555] text-[10px]">waters</p>
                    </div>
                  </div>
                </div>
                <p className="text-[#555555] text-[10px] mt-3 leading-relaxed">
                  Suggested stock includes a safety margin and learns from past forecasts vs actuals.
                </p>
              </div>

              <Separator className="bg-[#2A2A2A]" />

              <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#D43D3D] flex-shrink-0 mt-0.5" />
                <p className="text-[#888888] text-xs leading-relaxed">
                  AI insights load globally — see the{' '}
                  <span className="text-[#D43D3D]">Insights page</span> for the full list powered by Claude.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
