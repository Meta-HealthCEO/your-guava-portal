import { useState, useEffect } from 'react'
import { TrendingUp, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { Forecast } from '@/types'
import { cn } from '@/lib/utils'

// Mock weekly forecast data
// TODO: replace with GET /api/forecasts/week
const MOCK_WEEK: Array<Forecast & { label: string }> = [
  {
    _id: 'f1', label: 'Today', date: new Date().toISOString(),
    items: [{ itemName: 'Flat White', predictedQty: 71 }, { itemName: 'Cappuccino', predictedQty: 52 }],
    signals: { weather: { temp: 22, condition: 'Sunny', humidity: 55 }, loadSheddingStage: 0, isPublicHoliday: false, isSchoolHoliday: false, isPayday: false, dayOfWeek: 4 },
    totalPredictedRevenue: 7240, accuracy: 91.5,
  },
  {
    _id: 'f2', label: 'Tomorrow', date: new Date(Date.now() + 86400000).toISOString(),
    items: [{ itemName: 'Flat White', predictedQty: 84 }, { itemName: 'Cappuccino', predictedQty: 61 }],
    signals: { weather: { temp: 23, condition: 'Partly Cloudy', humidity: 62 }, loadSheddingStage: 0, isPublicHoliday: false, isSchoolHoliday: false, isPayday: true, dayOfWeek: 5 },
    totalPredictedRevenue: 8420, accuracy: 94.2,
  },
  {
    _id: 'f3', label: 'Saturday', date: new Date(Date.now() + 2 * 86400000).toISOString(),
    items: [{ itemName: 'Flat White', predictedQty: 96 }, { itemName: 'Cold Brew', predictedQty: 43 }],
    signals: { weather: { temp: 25, condition: 'Sunny', humidity: 48 }, loadSheddingStage: 0, isPublicHoliday: false, isSchoolHoliday: false, isPayday: true, dayOfWeek: 6 },
    totalPredictedRevenue: 9810, accuracy: undefined,
  },
  {
    _id: 'f4', label: 'Sunday', date: new Date(Date.now() + 3 * 86400000).toISOString(),
    items: [{ itemName: 'Flat White', predictedQty: 58 }, { itemName: 'Muffin', predictedQty: 35 }],
    signals: { weather: { temp: 21, condition: 'Cloudy', humidity: 70 }, loadSheddingStage: 2, isPublicHoliday: false, isSchoolHoliday: false, isPayday: false, dayOfWeek: 0 },
    totalPredictedRevenue: 5890, accuracy: undefined,
  },
]

interface ForecastWithLabel extends Forecast {
  label: string
}

function getDayLabel(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-ZA', { weekday: 'long' })
}

function ForecastRow({ forecast }: { forecast: ForecastWithLabel }) {
  const date = new Date(forecast.date)
  const dateStr = date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })
  const topItem = forecast.items[0]

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#1F1F1F] last:border-0">
      <div className="w-28 flex-shrink-0">
        <p className="text-[#F0F0F0] text-sm font-medium">{forecast.label}</p>
        <p className="text-[#555555] text-xs">{dateStr}</p>
      </div>

      <div className="flex-1 flex items-center gap-3">
        {/* Revenue */}
        <div className="w-28">
          <p className="text-[#4DA63B] text-sm font-semibold">
            R {forecast.totalPredictedRevenue.toLocaleString('en-ZA')}
          </p>
          <p className="text-[#555555] text-xs">predicted revenue</p>
        </div>

        {/* Top item */}
        <div className="w-32 hidden sm:block">
          <p className="text-[#F0F0F0] text-sm">{topItem.itemName}</p>
          <p className="text-[#555555] text-xs">{topItem.predictedQty} units</p>
        </div>

        {/* Signals */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {forecast.signals.isPayday && (
            <Badge variant="success" className="text-[10px] py-0 h-4 px-1.5">Payday</Badge>
          )}
          {forecast.signals.loadSheddingStage > 0 && (
            <Badge variant="warning" className="text-[10px] py-0 h-4 px-1.5">
              Stage {forecast.signals.loadSheddingStage}
            </Badge>
          )}
          {forecast.signals.isPublicHoliday && (
            <Badge variant="default" className="text-[10px] py-0 h-4 px-1.5">Holiday</Badge>
          )}
        </div>
      </div>

      {/* Accuracy */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {forecast.accuracy ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-[#4DA63B]" />
            <span className="text-[#4DA63B] text-xs font-semibold">{forecast.accuracy}%</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-[#555555]" />
            <span className="text-[#555555] text-xs">Pending</span>
          </>
        )}
      </div>

      {/* Weather */}
      <div className="flex-shrink-0 text-right hidden md:block">
        <p className="text-[#888888] text-sm">{forecast.signals.weather.temp}°C</p>
        <p className="text-[#555555] text-xs">{forecast.signals.weather.condition}</p>
      </div>
    </div>
  )
}

export default function Forecasts() {
  const [forecasts, setForecasts] = useState<ForecastWithLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const { data } = await api.get('/forecasts/week')
        if (data?.forecasts?.length) {
          const labeled = data.forecasts.map((f: Forecast) => ({
            ...f,
            label: getDayLabel(new Date(f.date)),
          }))
          setForecasts(labeled)
        }
      } catch {
        // Show empty state on error
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppLayout title="Forecasts">
      <div className="max-w-3xl space-y-5">
        {/* Summary header */}
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-[#D43D3D]" />
          <p className="text-[#888888] text-sm">7-day rolling sales forecast · Updated daily</p>
        </div>

        {/* Weekly forecast list */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                This Week
              </CardTitle>
              <span className="text-[#555555] text-xs">Based on your historical data</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-4 border-b border-[#1F1F1F]">
                    <Skeleton className="w-28 h-10" />
                    <Skeleton className="flex-1 h-10" />
                    <Skeleton className="w-16 h-6" />
                  </div>
                ))}
              </div>
            ) : (
              forecasts.map((f) => <ForecastRow key={f._id} forecast={f} />)
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-[#555555]">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-[#4DA63B]" />
            <span>Accuracy verified</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-[#555555]" />
            <span>Awaiting actuals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full bg-[#4DA63B]')} />
            <span>Payday weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD166]" />
            <span>Load shedding</span>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
