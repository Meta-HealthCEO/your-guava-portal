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
    if (matchesAny(item.itemName, COFFEE_KEYWORDS)) rollup.coffee += item.predictedQty
    else if (matchesAny(item.itemName, COLD_KEYWORDS)) rollup.cold += item.predictedQty
    else if (matchesAny(item.itemName, FOOD_KEYWORDS)) rollup.food += item.predictedQty
    else if (matchesAny(item.itemName, WATER_KEYWORDS)) rollup.water += item.predictedQty
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
            <p className="text-[#F0F0F0] font-semibold text-base">{getDayLabel(date)}</p>
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
          {/* Predicted revenue tile */}
          <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-4">
            <p className="text-[#888888] text-xs mb-1">Predicted revenue</p>
            <p className="text-[#F0F0F0] text-3xl font-bold">
              R {totalPredictedRevenue.toLocaleString('en-ZA')}
            </p>
            {weekAvg > 0 && (
              <p className={`text-sm mt-1 ${deltaColor}`}>
                {isNeutral ? 'On par with' : `${deltaPrefix}${delta.toFixed(0)}% vs`} weekly average
              </p>
            )}
          </div>

          {/* Why this prediction */}
          <div>
            <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
              Why this prediction?
            </p>
            <ModifierBreakdown signals={signals} />
          </div>

          <Separator className="bg-[#2A2A2A]" />

          {/* Item breakdown */}
          <div>
            <p className="text-[#F0F0F0] text-xs font-semibold uppercase tracking-wider mb-3">
              Item breakdown
            </p>
            <div className="space-y-0">
              <div className="grid grid-cols-3 pb-2 border-b border-[#2A2A2A]">
                <span className="text-[#555555] text-[10px] uppercase tracking-wider">Item</span>
                <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Predicted qty</span>
                <span className="text-[#555555] text-[10px] uppercase tracking-wider text-right">Revenue est.</span>
              </div>
              {sortedItems.map((item) => (
                <div key={item.itemName} className="grid grid-cols-3 py-2 border-b border-[#1F1F1F] last:border-0">
                  <span className="text-[#F0F0F0] text-xs">{item.itemName}</span>
                  <span className="text-[#888888] text-xs text-right">{item.predictedQty}</span>
                  <span className="text-[#555555] text-xs text-right">—</span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-[#2A2A2A]" />

          {/* Inventory hint */}
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
          </div>

          <Separator className="bg-[#2A2A2A]" />

          {/* AI insight placeholder */}
          <div className="rounded-lg bg-[#111111] border border-[#2A2A2A] p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#D43D3D] flex-shrink-0 mt-0.5" />
            <p className="text-[#888888] text-xs leading-relaxed">
              AI insights load globally — see the <span className="text-[#D43D3D]">Insights page</span> for the full list powered by Claude.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
