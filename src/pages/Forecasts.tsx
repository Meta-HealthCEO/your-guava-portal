import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { Forecast } from '@/types'
import { WeekHeader } from '@/components/forecasts/WeekHeader'
import { WeekTrajectoryChart } from '@/components/forecasts/WeekTrajectoryChart'
import { DayCard } from '@/components/forecasts/DayCard'
import { DayDetailDrawer } from '@/components/forecasts/DayDetailDrawer'
import { ItemsHeatmap } from '@/components/forecasts/ItemsHeatmap'

interface AccuracyPayload {
  avgAccuracy: number | null
  forecasts: {
    date: string
    accuracy: number
    totalPredictedRevenue: number
    actualRevenue?: number | null
    actualTransactionCount?: number | null
    actualsUpdatedAt?: string | null
  }[]
}

function formatTrainingDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function Forecasts() {
  const [futureForecasts, setFutureForecasts] = useState<Forecast[]>([])
  const [pastForecasts, setPastForecasts] = useState<Forecast[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [supportingDataError, setSupportingDataError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    setSupportingDataError(false)

    Promise.allSettled([
      api.get<{ forecasts: Forecast[] }>('/forecasts/week', { signal: controller.signal }),
      api.get<{ forecasts: Forecast[] }>('/forecasts/recent', { signal: controller.signal }),
      api.get<AccuracyPayload>('/forecasts/accuracy', { signal: controller.signal }),
    ]).then(([weekResult, recentResult, accuracyResult]) => {
      if (controller.signal.aborted) return
      if (weekResult.status === 'rejected') {
        setLoadError('Forecasts could not be loaded. Your existing data has not been removed.')
        return
      }

      setFutureForecasts(weekResult.value.data.forecasts || [])
      setPastForecasts(recentResult.status === 'fulfilled' ? recentResult.value.data.forecasts || [] : [])
      setAccuracy(accuracyResult.status === 'fulfilled' ? accuracyResult.value.data : null)
      setSupportingDataError(recentResult.status === 'rejected' || accuracyResult.status === 'rejected')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [reloadKey])

  const weekTotal = futureForecasts.reduce((s, f) => s + (f.totalPredictedRevenue || 0), 0)
  const peakDay = futureForecasts.reduce(
    (best, f) => (!best || f.totalPredictedRevenue > best.totalPredictedRevenue ? f : best),
    null as Forecast | null
  )
  const weekAvg = futureForecasts.length > 0 ? weekTotal / futureForecasts.length : 0
  const latestTrainingDate = futureForecasts
    .map((f) => f.trainingData?.lastTransactionDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  const freshestStaleDays = futureForecasts
    .map((f) => f.trainingData?.staleDays)
    .filter((days): days is number => typeof days === 'number')
    .sort((a, b) => a - b)[0]
  const showStaleDataNotice = latestTrainingDate != null && freshestStaleDays != null && freshestStaleDays > 30

  // Look up selected forecast from either array
  const selectedForecast =
    selectedForecastId != null
      ? [...futureForecasts, ...pastForecasts].find((f) => f._id === selectedForecastId) ?? null
      : null

  return (
    <AppLayout title="Planning">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted text-sm">
          <TrendingUp className="w-4 h-4 text-guava-red" />
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

        {!loading && loadError && (
          <div className="rounded-lg border border-red-900/30 bg-red-900/10 px-4 py-4" role="alert">
            <p className="text-sm text-red-300">{loadError}</p>
            <Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !loadError && futureForecasts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted">
              No forecast data yet. Upload sales data in Data Health to get started.
            </p>
          </div>
        )}

        {!loading && !loadError && futureForecasts.length > 0 && (
          <>
            {supportingDataError && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
                Forecasts are current, but recent comparisons or accuracy metrics are temporarily unavailable.
              </div>
            )}
            <WeekHeader
              weekTotal={weekTotal}
              peakDay={peakDay}
              accuracy={accuracy?.avgAccuracy ?? null}
            />
            {showStaleDataNotice && latestTrainingDate && (
              <div className="rounded-lg border border-guava-yellow/30 bg-guava-yellow/10 px-4 py-3">
                <p className="text-guava-yellow text-sm font-medium">Forecast data is getting stale</p>
                <p className="text-muted text-xs mt-1">
                  This week is based on sales history ending {formatTrainingDate(latestTrainingDate)}.
                  Upload newer transactions before relying on these numbers for ordering or staffing.
                </p>
              </div>
            )}
            <WeekTrajectoryChart futureForecasts={futureForecasts} pastForecasts={pastForecasts} />

            {/* This week's plan */}
            <div className="space-y-3">
              <div>
                <h2 className="text-text text-base font-semibold">This week's plan</h2>
                <p className="text-muted text-xs mt-0.5">
                  Predicted output for the next 7 days. Stock suggestions appear only when returned by the forecast service.
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
                <h2 className="text-text text-base font-semibold">Last week's results</h2>
                <p className="text-muted text-xs mt-0.5">
                  Predicted vs actual — see where we missed
                </p>
              </div>
              {pastForecasts.length === 0 ? (
                <p className="text-muted text-sm py-4">
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
