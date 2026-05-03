import { TrendingUp, Star, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Forecast } from '@/types'

function getDayName(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-ZA', { weekday: 'long' })
}

interface Props {
  weekTotal: number
  peakDay: Forecast | null
  accuracy: number | null
}

export function WeekHeader({ weekTotal, peakDay, accuracy }: Props) {
  const accuracyColor =
    accuracy === null
      ? 'text-[#888888]'
      : accuracy >= 80
      ? 'text-[#4DA63B]'
      : accuracy >= 60
      ? 'text-[#FFD166]'
      : 'text-[#D43D3D]'

  const accuracyLabel =
    accuracy === null ? 'No data' : `${Math.round(accuracy)}%`

  const accuracyStatus =
    accuracy === null
      ? ''
      : accuracy >= 80
      ? 'Strong'
      : accuracy >= 60
      ? 'Fair'
      : 'Weak'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Weekly predicted revenue */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#D43D3D]/10">
              <TrendingUp className="w-4 h-4 text-[#D43D3D]" />
            </div>
            <div>
              <p className="text-[#888888] text-xs mb-1">Weekly predicted revenue</p>
              <p className="text-[#F0F0F0] text-xl font-semibold">
                R {weekTotal.toLocaleString('en-ZA')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peak day */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#4DA63B]/10">
              <Star className="w-4 h-4 text-[#4DA63B]" />
            </div>
            <div>
              <p className="text-[#888888] text-xs mb-1">Peak day</p>
              {peakDay ? (
                <p className="text-[#F0F0F0] text-xl font-semibold">
                  {getDayName(peakDay.date)}{' '}
                  <span className="text-sm text-[#888888] font-normal">
                    — R {peakDay.totalPredictedRevenue.toLocaleString('en-ZA')}
                  </span>
                </p>
              ) : (
                <p className="text-[#888888] text-sm">—</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 30-day accuracy */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#555555]/20">
              <Target className="w-4 h-4 text-[#888888]" />
            </div>
            <div>
              <p className="text-[#888888] text-xs mb-1">30-day accuracy</p>
              <p className={`text-xl font-semibold ${accuracyColor}`}>
                {accuracyLabel}
                {accuracyStatus && (
                  <span className="text-xs font-normal text-[#888888] ml-2">
                    {accuracyStatus}
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
