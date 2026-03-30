import { useState, useEffect, useCallback } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, Clock, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  text: string
  category: 'trend' | 'warning' | 'tip' | 'highlight'
  generatedAt: string
}

const CATEGORY_CONFIG = {
  trend: {
    icon: TrendingUp,
    color: '#4DA63B',
    bg: '#4DA63B',
    label: 'Trend',
  },
  warning: {
    icon: AlertTriangle,
    color: '#FFD166',
    bg: '#FFD166',
    label: 'Watch',
  },
  tip: {
    icon: Lightbulb,
    color: '#D43D3D',
    bg: '#D43D3D',
    label: 'Tip',
  },
  highlight: {
    icon: Sparkles,
    color: '#4A9ECC',
    bg: '#4A9ECC',
    label: 'Highlight',
  },
}

// Mock insights — TODO: replace with GET /api/forecasts/insights
const MOCK_INSIGHTS: Insight[] = [
  {
    id: '1',
    category: 'trend',
    text: 'Your Flat White sales spike 34% on payday Fridays compared to regular Fridays. Consider preparing an extra 25–30 units this Friday given the upcoming month-end.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    category: 'warning',
    text: 'Croissant sales dropped 18% over the last 3 Sundays. This may indicate a supply consistency issue or changing customer preference on that day.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    category: 'tip',
    text: 'The 08:00–10:00 morning rush generates 36% of your daily revenue. Ensuring full staff coverage and prepared ingredients before 07:45 could reduce wait times and increase throughput.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    category: 'highlight',
    text: 'Cold Brew sales are trending up 22% month-on-month as Cape Town moves into summer. Based on historical patterns, you may want to increase Cold Brew prep by 30% for November.',
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    category: 'trend',
    text: "Saturday afternoons (13:00–16:00) are your lowest-revenue period, averaging only R420 compared to R1,840 during morning rush. This may be a good window for inventory prep or staff training.",
    generatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
]

function timeAgo(isoDate: string) {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff} minute${diff === 1 ? '' : 's'} ago`
  const hours = Math.floor(diff / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = CATEGORY_CONFIG[insight.category]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 flex gap-4',
        'hover:border-[#3A3A3A] transition-colors'
      )}
      style={{
        borderLeftColor: config.bg,
        borderLeftWidth: '3px',
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${config.bg}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant="outline"
            className="text-[10px] py-0 h-4 px-2"
            style={{ borderColor: `${config.bg}40`, color: config.color }}
          >
            {config.label}
          </Badge>
        </div>
        <p className="text-[#D0D0D0] text-sm leading-relaxed">{insight.text}</p>
      </div>
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 flex gap-4">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasData, setHasData] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const loadInsights = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const { data } = await api.get('/forecasts/insights')
      if (data?.insights?.length) {
        const mapped: Insight[] = data.insights.map((text: string, i: number) => ({
          id: String(i + 1),
          text,
          category: (['trend', 'warning', 'tip', 'highlight'] as const)[i % 4],
          generatedAt: data.generatedAt || new Date().toISOString(),
        }))
        setInsights(mapped)
        setHasData(true)
      } else {
        setHasData(false)
      }
      setLastUpdated(new Date().toISOString())
    } catch {
      // If Anthropic key not set, fall back to mock
      setInsights(MOCK_INSIGHTS)
      setHasData(true)
      setLastUpdated(new Date().toISOString())
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  const actions = (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <div className="flex items-center gap-1.5 text-[#555555] text-xs">
          <Clock className="w-3 h-3" />
          <span>Updated {timeAgo(lastUpdated)}</span>
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => loadInsights(true)}
        disabled={isRefreshing}
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  )

  return (
    <AppLayout
      title={
        <div className="flex items-center gap-2">
          <span>AI Insights</span>
          <Sparkles className="w-4 h-4 text-[#D43D3D]" />
        </div>
      }
      actions={actions}
    >
      {/* Header strip */}
      <div className="flex items-center gap-3 mb-6">
        <Badge variant="secondary" className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Powered by Claude
        </Badge>
        <p className="text-[#555555] text-sm">
          AI-generated insights based on your sales patterns and upcoming signals.
        </p>
      </div>

      {/* Empty state */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-[#555555]" />
          </div>
          <h2 className="text-[#F0F0F0] text-lg font-semibold mb-2">No insights yet</h2>
          <p className="text-[#555555] text-sm mb-6 max-w-xs">
            Upload your Yoco data to unlock AI-powered sales insights tailored to your cafe.
          </p>
          <Link to="/connect">
            <Button>
              <Upload className="w-4 h-4" />
              Upload Yoco Data
            </Button>
          </Link>
        </div>
      )}

      {/* Insights list */}
      {(isLoading || hasData) && (
        <div className="max-w-2xl space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <InsightSkeleton key={i} />)
            : insights.map((insight, i) => (
                <InsightCard key={insight.id} insight={insight} index={i} />
              ))}
        </div>
      )}
    </AppLayout>
  )
}
