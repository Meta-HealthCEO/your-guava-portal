import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { Forecast } from '@/types'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shortDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'short' })}`
}

function todayLabel(): string {
  return shortDayLabel(new Date().toISOString().slice(0, 10))
}

function fmtRevenue(value: number) {
  return `R ${value.toLocaleString('en-ZA')}`
}

interface ChartDatum {
  date: string
  predicted: number
  actual?: number
  isPast: boolean
}

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3 text-xs">
      <p className="text-[#888888] mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-[#888888]">{p.name}:</span>
          <span className="text-[#F0F0F0] font-semibold">{fmtRevenue(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  futureForecasts: Forecast[]
  pastForecasts: Forecast[]
}

export function WeekTrajectoryChart({ futureForecasts, pastForecasts }: Props) {
  // Build map from past forecasts: date string → actual revenue proxy
  // We use totalPredictedRevenue from past forecasts as the "predicted" value,
  // and derive actual from accuracy if available.
  const pastMap = new Map<string, { predicted: number; actual?: number }>()
  pastForecasts.forEach((f) => {
    const actualRevenue =
      f.accuracy != null ? f.totalPredictedRevenue * (f.accuracy / 100) : undefined
    pastMap.set(f.date.slice(0, 10), {
      predicted: f.totalPredictedRevenue,
      actual: actualRevenue,
    })
  })

  // Combine into a single sorted 14-day series
  const allDates = new Set<string>()
  pastForecasts.forEach((f) => allDates.add(f.date.slice(0, 10)))
  futureForecasts.forEach((f) => allDates.add(f.date.slice(0, 10)))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const data: ChartDatum[] = Array.from(allDates)
    .sort()
    .map((dateStr) => {
      const d = new Date(dateStr)
      d.setHours(0, 0, 0, 0)
      const isPast = d < today
      const past = pastMap.get(dateStr)
      const future = futureForecasts.find((f) => f.date.slice(0, 10) === dateStr)

      const predicted = past?.predicted ?? future?.totalPredictedRevenue ?? 0
      const actual = past?.actual

      return {
        date: shortDayLabel(dateStr),
        predicted,
        actual,
        isPast,
      }
    })

  const todayStr = todayLabel()
  const hasActual = data.some((d) => d.actual !== undefined)

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5">
      <p className="text-[#F0F0F0] text-sm font-semibold mb-4">Revenue trajectory</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#888888', fontSize: 11 }}
            axisLine={{ stroke: '#2A2A2A' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `R ${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#888888', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#888888', paddingTop: 8 }} />
          <ReferenceLine
            x={todayStr}
            stroke="#4DA63B"
            strokeDasharray="3 3"
            label={{ value: 'Today', position: 'top', fill: '#4DA63B', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke="#D43D3D"
            strokeWidth={2}
            dot={{ r: 3, fill: '#D43D3D', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          {hasActual && (
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#888888"
              strokeWidth={2}
              dot={{ r: 4, fill: '#888888', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
