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
      ? 'text-muted'
      : accuracy >= 80
      ? 'text-guava-green'
      : accuracy >= 60
      ? 'text-guava-yellow'
      : 'text-guava-red'

  const accuracyLabel =
    accuracy === null ? 'Awaiting matched sales data' : `${Math.round(accuracy)}%`

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
            <div className="p-2 rounded-lg bg-guava-red/10">
              <TrendingUp className="w-4 h-4 text-guava-red" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Weekly predicted revenue</p>
              <p className="text-text text-xl font-semibold">
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
            <div className="p-2 rounded-lg bg-guava-green/10">
              <Star className="w-4 h-4 text-guava-green" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Peak day</p>
              {peakDay ? (
                <p className="text-text text-xl font-semibold">
                  {getDayName(peakDay.date)}{' '}
                  <span className="text-sm text-muted font-normal">
                    — R {peakDay.totalPredictedRevenue.toLocaleString('en-ZA')}
                  </span>
                </p>
              ) : (
                <p className="text-muted text-sm">—</p>
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
              <Target className="w-4 h-4 text-muted" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">30-day accuracy</p>
              <p className={`text-xl font-semibold ${accuracyColor}`}>
                {accuracyLabel}
                {accuracyStatus && (
                  <span className="text-xs font-normal text-muted ml-2">
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
