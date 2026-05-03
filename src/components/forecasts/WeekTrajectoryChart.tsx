import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Forecast } from '@/types'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shortDay(dateStr: string): string {
  return SHORT_DAYS[new Date(dateStr).getDay()]
}

function fmtRevenue(value: number) {
  return `R ${value.toLocaleString('en-ZA')}`
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
  forecasts: Forecast[]
  lastWeekRevenue: { date: string; revenue: number }[]
}

export function WeekTrajectoryChart({ forecasts, lastWeekRevenue }: Props) {
  // Build a map of last week revenue by short day name for rough alignment
  const lastWeekMap: Record<string, number> = {}
  lastWeekRevenue.forEach((r) => {
    const day = shortDay(r.date)
    lastWeekMap[day] = r.revenue
  })

  const data = forecasts.map((f) => {
    const day = shortDay(f.date)
    const entry: { day: string; predicted: number; actual?: number } = {
      day,
      predicted: f.totalPredictedRevenue,
    }
    if (lastWeekMap[day] !== undefined) {
      entry.actual = lastWeekMap[day]
    }
    return entry
  })

  const hasActual = data.some((d) => d.actual !== undefined)

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5">
      <p className="text-[#F0F0F0] text-sm font-semibold mb-4">Revenue trajectory</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#888888', fontSize: 12 }}
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
          {hasActual && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#888888', paddingTop: 8 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke="#D43D3D"
            strokeWidth={2}
            dot={{ r: 3, fill: '#D43D3D', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          {hasActual && (
            <Line
              type="monotone"
              dataKey="actual"
              name="Last week actual"
              stroke="#666666"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: '#666666', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
