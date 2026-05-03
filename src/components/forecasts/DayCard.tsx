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

interface Props {
  forecast: Forecast
  weekAvg: number
  onClick: () => void
}

export function DayCard({ forecast, weekAvg, onClick }: Props) {
  const { signals, items, totalPredictedRevenue, date } = forecast

  const delta = weekAvg > 0 ? ((totalPredictedRevenue - weekAvg) / weekAvg) * 100 : 0
  const isNeutral = Math.abs(delta) <= 5
  const deltaColor = isNeutral
    ? 'text-[#888888]'
    : delta > 0
    ? 'text-[#4DA63B]'
    : 'text-[#D43D3D]'
  const deltaPrefix = delta > 0 ? '+' : ''

  // Top 5 items sorted by qty
  const top5 = [...items].sort((a, b) => b.predictedQty - a.predictedQty).slice(0, 5)
  const maxQty = top5.length > 0 ? top5[0].predictedQty : 1

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
            {!isNeutral && (
              <p className={`text-xs ${deltaColor}`}>
                {deltaPrefix}{delta.toFixed(0)}% vs avg
              </p>
            )}
            {isNeutral && weekAvg > 0 && (
              <p className="text-xs text-[#555555]">avg</p>
            )}
          </div>
        </div>

        {/* Top 5 items mini-bars */}
        {top5.length > 0 && (
          <div className="space-y-1.5">
            {top5.map((item) => (
              <div key={item.itemName} className="flex items-center gap-2">
                <span className="text-[#888888] text-[10px] w-28 truncate flex-shrink-0">
                  {item.itemName}
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                  <div
                    className="h-1.5 rounded-full bg-[#D43D3D]/60"
                    style={{ width: `${Math.max(8, (item.predictedQty / maxQty) * 100)}%` }}
                  />
                  <span className="text-[#555555] text-[10px]">{item.predictedQty}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Signal chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {/* Weather always shown */}
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
      </CardContent>
    </Card>
  )
}
