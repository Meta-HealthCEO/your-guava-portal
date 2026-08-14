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

interface WeekMeta {
  expectedDays: number
  generatedDays: number
  failedDays: { dateKey: string; message: string }[]
  isPartial: boolean
  insufficientData: boolean
  insufficientDays: string[]
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
  const [weekMeta, setWeekMeta] = useState<WeekMeta | null>(null)
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
      api.get<{ forecasts: Forecast[]; meta?: WeekMeta }>('/forecasts/week', { signal: controller.signal }),
      api.get<{ forecasts: Forecast[] }>('/forecasts/recent', { signal: controller.signal }),
      api.get<AccuracyPayload>('/forecasts/accuracy', { signal: controller.signal }),
    ]).then(([weekResult, recentResult, accuracyResult]) => {
      if (controller.signal.aborted) return
      if (weekResult.status === 'rejected') {
        setLoadError('Forecasts could not be loaded. Your existing data has not been removed.')
        return
      }

      setFutureForecasts(weekResult.value.data.forecasts || [])
      setWeekMeta(weekResult.value.data.meta || null)
      setPastForecasts(recentResult.status === 'fulfilled' ? recentResult.value.data.forecasts || [] : [])
      setAccuracy(accuracyResult.status === 'fulfilled' ? accuracyResult.value.data : null)
      setSupportingDataError(recentResult.status === 'rejected' || accuracyResult.status === 'rejected')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [reloadKey])

  const usableForecasts = futureForecasts.filter(
    (forecast) => forecast.availability?.status !== 'insufficient_data'
  )
  const tradingForecasts = usableForecasts.filter(
    (forecast) => forecast.availability?.status !== 'closed'
  )
  const allForecastsInsufficient =
    futureForecasts.length > 0 && usableForecasts.length === 0
  const allForecastGenerationFailed =
    futureForecasts.length === 0 &&
    weekMeta?.isPartial === true &&
    (weekMeta.failedDays?.length || 0) > 0
  const weekTotal = usableForecasts.reduce((s, f) => s + (f.totalPredictedRevenue || 0), 0)
  const peakDay = tradingForecasts.reduce(
    (best, f) => (!best || f.totalPredictedRevenue > best.totalPredictedRevenue ? f : best),
    null as Forecast | null
  )
  const weekAvg = tradingForecasts.length > 0 ? weekTotal / tradingForecasts.length : 0
  const oldestTrainingDate = futureForecasts
    .map((forecast) => forecast.trainingData?.lastTransactionDate)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
  const worstStaleDays = futureForecasts
    .map((f) => f.trainingData?.staleDays)
    .filter((days): days is number => typeof days === 'number')
    .sort((a, b) => b - a)[0]
  const showStaleDataNotice = oldestTrainingDate != null && worstStaleDays != null && worstStaleDays > 30

  // Look up selected forecast from either array
  const selectedForecast =
    selectedForecastId != null
      ? [...futureForecasts, ...pastForecasts].find((f) => f._id === selectedForecastId) ?? null
      : null

  return (
    <AppLayout title="Planning">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted text-sm">
          <TrendingUp className="w-4 h-4 text-guava-red-text" />
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

        {!loading && !loadError && allForecastGenerationFailed && (
          <div className="rounded-lg border border-red-900/30 bg-red-900/10 px-4 py-4" role="alert">
            <p className="text-sm text-red-300">
              No forecast days could be generated. Your uploaded sales data is still safe.
            </p>
            <Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !loadError && !allForecastGenerationFailed && (futureForecasts.length === 0 || allForecastsInsufficient) && (
          <div className="text-center py-12">
            <p className="text-text font-medium">No forecast data yet</p>
            <p className="text-muted text-sm mt-1">
              Not enough matching sales history is available. Upload at least three comparable trading weeks
              before using forecasts for ordering or staffing.
            </p>
          </div>
        )}

        {!loading && !loadError && usableForecasts.length > 0 && (
          <>
            {weekMeta?.isPartial && (
              <div className="rounded-lg border border-red-900/30 bg-red-900/10 px-4 py-3 text-sm text-red-300" role="alert">
                Only {weekMeta.generatedDays} of {weekMeta.expectedDays} forecast days are available.
                Do not treat this as a complete weekly plan. Try again before ordering or staffing.
              </div>
            )}
            {weekMeta?.insufficientData && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
                Some days are hidden because they do not yet have three comparable weeks of sales history.
              </div>
            )}
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
            {showStaleDataNotice && oldestTrainingDate && (
              <div className="rounded-lg border border-guava-yellow/30 bg-guava-yellow/10 px-4 py-3">
                <p className="text-guava-yellow text-sm font-medium">Forecast data is getting stale</p>
                <p className="text-muted text-xs mt-1">
                  Some days are based on sales history ending as early as {formatTrainingDate(oldestTrainingDate)}.
                  Upload newer transactions before relying on these numbers for ordering or staffing.
                </p>
              </div>
            )}
            <WeekTrajectoryChart futureForecasts={usableForecasts} pastForecasts={pastForecasts} />

            {/* This week's plan */}
            <div className="space-y-3">
              <div>
                <h2 className="text-text text-base font-semibold">This week's plan</h2>
                <p className="text-muted text-xs mt-0.5">
                  Predicted output for the next 7 days. Stock suggestions appear only when returned by the forecast service.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usableForecasts.map((f) => (
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

            <ItemsHeatmap forecasts={usableForecasts} />
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
