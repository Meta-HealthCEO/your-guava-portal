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
  const [futureForecasts, setFutureForecasts] = useState<Forecast[]>([])
  const [pastForecasts, setPastForecasts] = useState<Forecast[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<{ forecasts: Forecast[] }>('/forecasts/week'),
      api.get<{ forecasts: Forecast[] }>('/forecasts/recent').catch(() => ({ data: { forecasts: [] } })),
      api.get<AccuracyPayload>('/forecasts/accuracy'),
    ])
      .then(([wk, recent, acc]) => {
        setFutureForecasts(wk.data.forecasts)
        setPastForecasts(recent.data.forecasts)
        setAccuracy(acc.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const weekTotal = futureForecasts.reduce((s, f) => s + (f.totalPredictedRevenue || 0), 0)
  const peakDay = futureForecasts.reduce(
    (best, f) => (!best || f.totalPredictedRevenue > best.totalPredictedRevenue ? f : best),
    null as Forecast | null
  )
  const weekAvg = futureForecasts.length > 0 ? weekTotal / futureForecasts.length : 0

  // Look up selected forecast from either array
  const selectedForecast =
    selectedForecastId != null
      ? [...futureForecasts, ...pastForecasts].find((f) => f._id === selectedForecastId) ?? null
      : null

  return (
    <AppLayout title="Forecasts">
      <div className="space-y-6">
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

        {!loading && futureForecasts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#888888]">
              No forecast data yet. Upload sales data on the Connect page to get started.
            </p>
          </div>
        )}

        {!loading && futureForecasts.length > 0 && (
          <>
            <WeekHeader
              weekTotal={weekTotal}
              peakDay={peakDay}
              accuracy={accuracy?.avgAccuracy ?? null}
            />
            <WeekTrajectoryChart futureForecasts={futureForecasts} pastForecasts={pastForecasts} />

            {/* This week's plan */}
            <div className="space-y-3">
              <div>
                <h2 className="text-[#F0F0F0] text-base font-semibold">This week's plan</h2>
                <p className="text-[#888888] text-xs mt-0.5">
                  Predicted output and suggested stock for the next 7 days
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {futureForecasts.map((f) => (
                  <DayCard
                    key={f._id}
                    forecast={f}
                    weekAvg={weekAvg}
                    mode="plan"
                    onClick={() => setSelectedForecastId(f._id)}
                  />
                ))}
              </div>
            </div>

            {/* Last week's results */}
            <div className="space-y-3">
              <div>
                <h2 className="text-[#F0F0F0] text-base font-semibold">Last week's results</h2>
                <p className="text-[#888888] text-xs mt-0.5">
                  Predicted vs actual — see where we missed
                </p>
              </div>
              {pastForecasts.length === 0 ? (
                <p className="text-[#555555] text-sm py-4">
                  No past forecasts yet — your first comparison will appear once today's predictions
                  can be checked against tomorrow's data.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastForecasts.map((f) => (
                    <DayCard
                      key={f._id}
                      forecast={f}
                      weekAvg={weekAvg}
                      mode="review"
                      onClick={() => setSelectedForecastId(f._id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <ItemsHeatmap forecasts={futureForecasts} />
          </>
        )}

        {selectedForecast && (
          <DayDetailDrawer
            forecast={selectedForecast}
            weekAvg={weekAvg}
            onClose={() => setSelectedForecastId(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}
