import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarDays,
  CreditCard,
  Banknote,
  Percent,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import type {
  RevenueAnalytics,
  ItemPerformance,
  HeatmapCell,
  CustomerInsights,
} from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatZAR(amount: number) {
  return `R${amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

type TabId = 'revenue' | 'items' | 'heatmap' | 'customers'

const TABS: { id: TabId; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'items', label: 'Items' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'customers', label: 'Customers' },
]

type PeriodId = '7d' | '30d' | '90d'

function daysForPeriod(period: PeriodId): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90
}

function getDateRange(period: PeriodId) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - daysForPeriod(period))
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 06:00 - 22:00

// ── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab() {
  const [period, setPeriod] = useState<PeriodId>('30d')
  const [data, setData] = useState<RevenueAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const { startDate, endDate } = getDateRange(period)
    api
      .get<{ analytics: RevenueAnalytics }>(`/api/analytics/revenue?period=daily&startDate=${startDate}&endDate=${endDate}`)
      .then(({ data: res }) => setData(res.analytics))
      .catch(() => setError('Failed to load revenue data'))
      .finally(() => setLoading(false))
  }, [period])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#888888] text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setPeriod(period)}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {(['7d', '30d', '90d'] as PeriodId[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          ))
        ) : data ? (
          <>
            <KpiCard label="Total Revenue" value={formatZAR(data.totalRevenue)} icon={DollarSign} accent="#4DA63B" />
            <KpiCard label="Avg Daily" value={formatZAR(data.avgDailyRevenue)} icon={CalendarDays} accent="#4A9ECC" />
            <KpiCard
              label="Best Day"
              value={formatZAR(data.bestDay.revenue)}
              sub={formatDate(data.bestDay.date)}
              icon={TrendingUp}
              accent="#FFD166"
            />
            <KpiCard
              label="Trend"
              value={`${data.trend >= 0 ? '+' : ''}${data.trend.toFixed(1)}%`}
              icon={data.trend >= 0 ? TrendingUp : TrendingDown}
              accent={data.trend >= 0 ? '#4DA63B' : '#D43D3D'}
            />
          </>
        ) : null}
      </div>

      {/* Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : data && data.data.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4DA63B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4DA63B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickFormatter={(v: string) => formatDate(v)}
                    stroke="#2A2A2A"
                  />
                  <YAxis
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickFormatter={(v: number) => `R${(v / 1000).toFixed(0)}k`}
                    stroke="#2A2A2A"
                  />
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#F0F0F0' }}
                    labelFormatter={(v: string) => formatDate(v)}
                    formatter={(value: number) => [formatZAR(value), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4DA63B"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[#555555] text-sm text-center py-16">No revenue data for this period</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Items Tab ────────────────────────────────────────────────────────────────

function ItemsTab() {
  const [items, setItems] = useState<ItemPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get<{ items: ItemPerformance[] }>('/api/analytics/items')
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setError('Failed to load item data'))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => [...items].sort((a, b) => b.totalQty - a.totalQty), [items])
  const top10 = sorted.slice(0, 10)

  // Rising and declining
  const byTrend = useMemo(() => [...items].sort((a, b) => b.trend - a.trend), [items])
  const risingNames = new Set(byTrend.slice(0, 3).map((i) => i.name))
  const decliningNames = new Set(byTrend.slice(-3).map((i) => i.name))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#888888] text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart: top 10 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top 10 Items by Quantity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : top10.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#888888', fontSize: 10 }}
                    stroke="#2A2A2A"
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: '#888888', fontSize: 11 }} stroke="#2A2A2A" />
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#F0F0F0' }}
                    formatter={(value: number) => [value, 'Qty Sold']}
                  />
                  <Bar dataKey="totalQty" fill="#4DA63B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[#555555] text-sm text-center py-16">No item data available</p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Item Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="text-left py-2 pr-4 text-[#888888] font-medium">Item</th>
                    <th className="text-right py-2 px-4 text-[#888888] font-medium">Sold</th>
                    <th className="text-right py-2 px-4 text-[#888888] font-medium">Revenue</th>
                    <th className="text-right py-2 px-4 text-[#888888] font-medium">Avg/Day</th>
                    <th className="text-right py-2 pl-4 text-[#888888] font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const isRising = risingNames.has(item.name)
                    const isDeclining = decliningNames.has(item.name)
                    return (
                      <tr
                        key={item.name}
                        className={cn(
                          'border-b border-[#1F1F1F] last:border-0',
                          isRising && 'bg-[#4DA63B]/5',
                          isDeclining && 'bg-[#D43D3D]/5'
                        )}
                      >
                        <td className="py-2.5 pr-4 text-[#F0F0F0]">{item.name}</td>
                        <td className="py-2.5 px-4 text-right text-[#F0F0F0] tabular-nums">{item.totalQty}</td>
                        <td className="py-2.5 px-4 text-right text-[#F0F0F0] tabular-nums">{formatZAR(item.totalRevenue)}</td>
                        <td className="py-2.5 px-4 text-right text-[#888888] tabular-nums">{item.avgPerDay.toFixed(1)}</td>
                        <td className="py-2.5 pl-4 text-right">
                          <Badge variant={item.trend >= 0 ? 'success' : 'destructive'} className="text-[10px]">
                            {item.trend >= 0 ? (
                              <TrendingUp className="w-3 h-3 mr-0.5" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-0.5" />
                            )}
                            {item.trend >= 0 ? '+' : ''}{item.trend.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[#555555] text-sm text-center py-16">No item data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Heatmap Tab ──────────────────────────────────────────────────────────────

function HeatmapTab() {
  const [cells, setCells] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get<{ heatmap: HeatmapCell[] }>('/api/analytics/heatmap')
      .then(({ data }) => setCells(data.heatmap || []))
      .catch(() => setError('Failed to load heatmap data'))
      .finally(() => setLoading(false))
  }, [])

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    cells.forEach((c) => map.set(`${c.dayOfWeek}-${c.hour}`, c))
    return map
  }, [cells])

  const maxRevenue = useMemo(() => Math.max(...cells.map((c) => c.revenue), 1), [cells])

  function getCellColor(revenue: number) {
    const intensity = revenue / maxRevenue
    if (intensity < 0.1) return '#1A1A1A'
    if (intensity < 0.25) return '#1E2A1E'
    if (intensity < 0.5) return '#2A4A2A'
    if (intensity < 0.75) return '#3A6A3A'
    return '#4DA63B'
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#888888] text-sm">{error}</p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Revenue Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] rounded-lg" />
        ) : cells.length > 0 ? (
          <div className="relative">
            {/* Tooltip */}
            {hoveredCell && (
              <div className="absolute top-0 right-0 bg-[#111111] border border-[#2A2A2A] rounded-lg px-3 py-2 z-10 text-xs">
                <p className="text-[#F0F0F0] font-medium">
                  {DAYS[hoveredCell.dayOfWeek]} {String(hoveredCell.hour).padStart(2, '0')}:00
                </p>
                <p className="text-[#888888]">{formatZAR(hoveredCell.revenue)} avg</p>
                <p className="text-[#555555]">{hoveredCell.transactions} transactions</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour headers */}
                <div className="flex items-center mb-1">
                  <div className="w-10 shrink-0" />
                  {HOURS.map((h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-[#555555]">
                      {String(h).padStart(2, '0')}
                    </div>
                  ))}
                </div>
                {/* Grid rows */}
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className="flex items-center mb-0.5">
                    <div className="w-10 shrink-0 text-[11px] text-[#888888]">{day}</div>
                    {HOURS.map((hour) => {
                      const cell = cellMap.get(`${dayIdx}-${hour}`)
                      const revenue = cell?.revenue ?? 0
                      return (
                        <div
                          key={hour}
                          className="flex-1 aspect-square rounded-sm mx-0.5 cursor-pointer transition-opacity hover:opacity-80"
                          style={{ backgroundColor: getCellColor(revenue) }}
                          onMouseEnter={() =>
                            setHoveredCell(cell ?? { dayOfWeek: dayIdx, hour, revenue: 0, transactions: 0 })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-3">
              <span className="text-[10px] text-[#555555] mr-1">Less</span>
              {['#1A1A1A', '#1E2A1E', '#2A4A2A', '#3A6A3A', '#4DA63B'].map((color) => (
                <div key={color} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              ))}
              <span className="text-[10px] text-[#555555] ml-1">More</span>
            </div>
          </div>
        ) : (
          <p className="text-[#555555] text-sm text-center py-16">No heatmap data available</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Customers Tab ────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#4DA63B', '#D43D3D']

function CustomersTab() {
  const [data, setData] = useState<CustomerInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get<{ insights: CustomerInsights }>('/api/analytics/customers')
      .then(({ data: res }) => setData(res.insights))
      .catch(() => setError('Failed to load customer insights'))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#888888] text-sm">{error}</p>
      </div>
    )
  }

  const donutData = data
    ? [
        { name: 'Card', value: data.cashVsCardRatio.card },
        { name: 'Cash', value: data.cashVsCardRatio.cash },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          ))
        ) : data ? (
          <>
            <KpiCard
              label="Avg Transaction"
              value={formatZAR(data.avgTransactionValue)}
              icon={DollarSign}
              accent="#4DA63B"
            />
            <KpiCard
              label="Avg Items/Transaction"
              value={data.avgItemsPerTransaction.toFixed(1)}
              icon={BarChart3}
              accent="#4A9ECC"
            />
            <KpiCard
              label="Tipping Rate"
              value={`${(data.tippingRate * 100).toFixed(1)}%`}
              icon={Percent}
              accent="#FFD166"
            />
            <KpiCard
              label="Avg Tip"
              value={formatZAR(data.avgTip)}
              icon={Banknote}
              accent="#4DA63B"
            />
          </>
        ) : null}
      </div>

      {/* Cash vs Card Donut */}
      {!loading && data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment Method Split</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
              <div style={{ height: 200, width: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {donutData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#F0F0F0' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#4DA63B]" />
                  <span className="text-[#F0F0F0] text-sm">Card: {data.cashVsCardRatio.card.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#D43D3D]" />
                  <span className="text-[#F0F0F0] text-sm">Cash: {data.cashVsCardRatio.cash.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Shared KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  accent: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#888888] text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-[#F0F0F0] text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-[#555555] text-xs mt-1">{sub}</p>}
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}18` }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabId>('revenue')

  return (
    <AppLayout title="Analytics">
      {/* Tab Selector */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#2A2A2A] pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-[#D43D3D]'
                : 'text-[#888888] hover:text-[#F0F0F0]'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D43D3D] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'revenue' && <RevenueTab />}
      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'heatmap' && <HeatmapTab />}
      {activeTab === 'customers' && <CustomersTab />}
    </AppLayout>
  )
}
