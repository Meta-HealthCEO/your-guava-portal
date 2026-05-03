import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { Forecast } from '@/types'
import { WeekHeader } from '@/components/forecasts/WeekHeader'
import { WeekTrajectoryChart } from '@/components/forecasts/WeekTrajectoryChart'
import { DayCard } from '@/components/forecasts/DayCard'
import { DayDetailDrawer } from '@/components/forecasts/DayDetailDrawer'
import { ItemsHeatmap } from '@/components/forecasts/ItemsHeatmap'

interface AccuracyPayload {
  avgAccuracy: number | null
  forecasts: { date: string; accuracy: number; totalPredictedRevenue: number }[]
}

export default function Forecasts() {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyPayload | null>(null)
  const [lastWeekRevenue, setLastWeekRevenue] = useState<{ date: string; revenue: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  useEffect(() => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 8)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 1)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    Promise.all([
      api.get<{ forecasts: Forecast[] }>('/forecasts/week'),
      api.get<AccuracyPayload>('/forecasts/accuracy'),
      api
        .get<{ data: { date: string; revenue: number }[] }>(
          `/analytics/revenue?startDate=${fmt(startDate)}&endDate=${fmt(endDate)}`
        )
        .catch(() => ({ data: { data: [] } })),
    ])
      .then(([wk, acc, rev]) => {
        setForecasts(wk.data.forecasts)
        setAccuracy(acc.data)
        setLastWeekRevenue(rev.data.data || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const weekTotal = forecasts.reduce((s, f) => s + (f.totalPredictedRevenue || 0), 0)
  const peakDay = forecasts.reduce(
    (best, f) => (!best || f.totalPredictedRevenue > best.totalPredictedRevenue ? f : best),
    null as Forecast | null
  )
  const weekAvg = forecasts.length > 0 ? weekTotal / forecasts.length : 0

  return (
    <AppLayout title="Forecasts">
      <div className="max-w-7xl space-y-6">
        <div className="flex items-center gap-2 text-[#555555] text-sm">
          <TrendingUp className="w-4 h-4 text-[#D43D3D]" />
          7-day rolling sales forecast · Updated daily
        </div>

        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-72 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
        )}

        {!loading && forecasts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#888888]">
              No forecast data yet. Upload sales data on the Connect page to get started.
            </p>
          </div>
        )}

        {!loading && forecasts.length > 0 && (
          <>
            <WeekHeader
              weekTotal={weekTotal}
              peakDay={peakDay}
              accuracy={accuracy?.avgAccuracy ?? null}
            />
            <WeekTrajectoryChart forecasts={forecasts} lastWeekRevenue={lastWeekRevenue} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forecasts.map((f, i) => (
                <DayCard
                  key={f._id}
                  forecast={f}
                  weekAvg={weekAvg}
                  onClick={() => setSelectedIdx(i)}
                />
              ))}
            </div>
            <ItemsHeatmap forecasts={forecasts} />
          </>
        )}

        {selectedIdx !== null && forecasts[selectedIdx] && (
          <DayDetailDrawer
            forecast={forecasts[selectedIdx]}
            weekAvg={weekAvg}
            onClose={() => setSelectedIdx(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}
