import { Cloud, Zap, Calendar, Banknote, Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
  })
}

function deltaColor(pct: number): string {
  const abs = Math.abs(pct)
  if (abs <= 5) return 'text-[#4DA63B]'
  if (abs <= 15) return 'text-[#FFD166]'
  return 'text-[#D43D3D]'
}

interface Props {
  forecast: Forecast
  weekAvg: number
  mode?: 'plan' | 'review'
  onClick: () => void
}

export function DayCard({ forecast, weekAvg, mode = 'plan', onClick }: Props) {
  const { signals, items, totalPredictedRevenue, date } = forecast

  const delta = weekAvg > 0 ? ((totalPredictedRevenue - weekAvg) / weekAvg) * 100 : 0
  const isNeutral = Math.abs(delta) <= 5
  const revDeltaColor = isNeutral
    ? 'text-[#888888]'
    : delta > 0
    ? 'text-[#4DA63B]'
    : 'text-[#D43D3D]'
  const deltaPrefix = delta > 0 ? '+' : ''

  // ── Plan mode ──────────────────────────────────────────────────────────────
  const top5Plan = [...items].sort((a, b) => b.predictedQty - a.predictedQty).slice(0, 5)
  const maxQtyPlan = top5Plan.length > 0 ? top5Plan[0].predictedQty : 1

  // ── Review mode ────────────────────────────────────────────────────────────
  const hasActuals = items.some((it) => it.actualQty != null)
  const top5Review = [...items]
    .sort((a, b) => b.predictedQty - a.predictedQty)
    .slice(0, 5)

  // Accuracy badge colour
  const acc = forecast.accuracy ?? null
  const accColor =
    acc === null
      ? 'text-[#888888]'
      : acc >= 85
      ? 'text-[#4DA63B]'
      : acc >= 70
      ? 'text-[#FFD166]'
      : 'text-[#D43D3D]'

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-[#444444] transition-colors"
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#F0F0F0] font-semibold text-sm">{getDayLabel(date)}</p>
            <p className="text-[#555555] text-xs">{formatDate(date)}</p>
          </div>
          <div className="text-right">
            <p className="text-[#F0F0F0] font-bold text-lg leading-tight">
              R {totalPredictedRevenue.toLocaleString('en-ZA')}
            </p>
            {mode === 'plan' && !isNeutral && (
              <p className={`text-xs ${revDeltaColor}`}>
                {deltaPrefix}{delta.toFixed(0)}% vs avg
              </p>
            )}
            {mode === 'plan' && isNeutral && weekAvg > 0 && (
              <p className="text-xs text-[#555555]">avg</p>
            )}
            {mode === 'review' && acc !== null && (
              <p className={`text-xs font-medium ${accColor}`}>
                Accuracy: {Math.round(acc)}%
              </p>
            )}
          </div>
        </div>

        {/* Items */}
        {mode === 'plan' && top5Plan.length > 0 && (
          <div className="space-y-1.5">
            {top5Plan.map((item) => {
              const stock =
                item.suggestedStock != null
                  ? item.suggestedStock
                  : Math.ceil(item.predictedQty * 1.1)
              return (
                <div key={item.itemName} className="flex items-center gap-2">
                  <span className="text-[#888888] text-[10px] w-28 truncate flex-shrink-0">
                    {item.itemName}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <div
                      className="h-1.5 rounded-full bg-[#D43D3D]/60"
                      style={{ width: `${Math.max(8, (item.predictedQty / maxQtyPlan) * 100)}%` }}
                    />
                    <div className="flex flex-col leading-none">
                      <span className="text-[#555555] text-[10px]">
                        Predicted: {item.predictedQty}
                      </span>
                      <span className="text-[#444444] text-[10px]">
                        Stock: {stock}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mode === 'review' && top5Review.length > 0 && (
          <div className="space-y-1.5">
            {top5Review.map((item) => {
              const pred = item.predictedQty
              const actual = item.actualQty
              const maxBar = actual != null ? Math.max(pred, actual) : pred
              const barFill = actual != null
                ? actual >= pred
                  ? 'bg-[#4DA63B]/60'
                  : 'bg-[#D43D3D]/60'
                : 'bg-[#D43D3D]/60'
              const barWidth = actual != null
                ? Math.max(8, (actual / maxBar) * 100)
                : Math.max(8, (pred / (top5Review[0].predictedQty || 1)) * 100)

              let deltaLabel: React.ReactNode = null
              if (actual != null) {
                const pct = pred > 0 ? ((actual - pred) / pred) * 100 : 0
                const sign = pct >= 0 ? '+' : ''
                const color = deltaColor(pct)
                deltaLabel = (
                  <span className={`text-[10px] ${color}`}>
                    {sign}{pct.toFixed(0)}%
                  </span>
                )
              }

              return (
                <div key={item.itemName} className="flex items-center gap-2">
                  <span className="text-[#888888] text-[10px] w-28 truncate flex-shrink-0">
                    {item.itemName}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5">
                    {hasActuals && (
                      <div
                        className={`h-1.5 rounded-full ${barFill}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    )}
                    {!hasActuals && (
                      <div
                        className="h-1.5 rounded-full bg-[#D43D3D]/60"
                        style={{ width: `${Math.max(8, (pred / (top5Review[0].predictedQty || 1)) * 100)}%` }}
                      />
                    )}
                    <div className="flex flex-col leading-none gap-0.5">
                      {hasActuals ? (
                        <>
                          <span className="text-[#555555] text-[10px]">
                            pred: {pred}
                          </span>
                          {actual != null && (
                            <span className="text-[#888888] text-[10px]">
                              actual: {actual} {deltaLabel}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[#555555] text-[10px]">{pred}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Signal chips — only in plan mode (review is in the past, signals are historical context) */}
        {mode === 'plan' && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] py-0 h-5 px-1.5 gap-1 border-[#2A2A2A]">
              <Cloud className="w-2.5 h-2.5" />
              {signals.weather.temp}°C · {signals.weather.condition}
            </Badge>

            {signals.isPayday && (
              <Badge variant="success" className="text-[10px] py-0 h-5 px-1.5">
                <Banknote className="w-2.5 h-2.5 mr-1" />
                Payday
              </Badge>
            )}

            {signals.isPublicHoliday && (
              <Badge variant="warning" className="text-[10px] py-0 h-5 px-1.5">
                <Calendar className="w-2.5 h-2.5 mr-1" />
                Public holiday
              </Badge>
            )}

            {signals.isSchoolHoliday && !signals.isPublicHoliday && (
              <Badge variant="warning" className="text-[10px] py-0 h-5 px-1.5">
                <Calendar className="w-2.5 h-2.5 mr-1" />
                School holiday
              </Badge>
            )}

            {signals.loadSheddingStage > 0 && (
              <Badge variant="destructive" className="text-[10px] py-0 h-5 px-1.5">
                <Zap className="w-2.5 h-2.5 mr-1" />
                Stage {signals.loadSheddingStage}
              </Badge>
            )}

            {(signals.events ?? []).map((ev) => (
              <Badge
                key={ev.name}
                className="text-[10px] py-0 h-5 px-1.5 bg-purple-900/30 text-purple-400 border-transparent"
              >
                <Megaphone className="w-2.5 h-2.5 mr-1" />
                {ev.name} · {ev.impact}
              </Badge>
            ))}
          </div>
        )}

        {/* In review mode show a minimal weather chip so context isn't totally lost */}
        {mode === 'review' && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] py-0 h-5 px-1.5 gap-1 border-[#2A2A2A]">
              <Cloud className="w-2.5 h-2.5" />
              {signals.weather.temp}°C · {signals.weather.condition}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
