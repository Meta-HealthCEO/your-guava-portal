import { Cloud, Zap, Calendar, Banknote, Megaphone, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ForecastFactor } from '@/types'

interface Modifier {
  icon: ReactNode
  label: string
  effect: string
  active: boolean
  positive: boolean | null
  reason?: string
}

const ICONS: Record<string, ReactNode> = {
  weather: <Cloud className="w-3.5 h-3.5" />,
  loadShedding: <Zap className="w-3.5 h-3.5" />,
  holiday: <Calendar className="w-3.5 h-3.5" />,
  payday: <Banknote className="w-3.5 h-3.5" />,
  events: <Megaphone className="w-3.5 h-3.5" />,
  learning: <Sparkles className="w-3.5 h-3.5" />,
}

function modifierFromAppliedFactor(factor: ForecastFactor): Modifier {
  const pct = factor.adjustmentPct
  return {
    icon: ICONS[factor.key] ?? <Megaphone className="w-3.5 h-3.5" />,
    label: factor.label,
    effect: factor.effect ?? 'no effect',
    active: factor.active,
    positive: pct == null ? null : pct > 0 ? true : pct < 0 ? false : null,
    reason: factor.reason,
  }
}

interface Props {
  factors?: ForecastFactor[]
}

export function ModifierBreakdown({ factors }: Props) {
  const modifiers = factors?.map(modifierFromAppliedFactor) ?? []

  return (
    <div className="space-y-2">
      {modifiers.length === 0 ? (
        <p className="text-xs text-muted">Factor detail is unavailable for this forecast.</p>
      ) : null}
      {modifiers.map((m) => {
        const iconColor = m.active
          ? m.positive === false
            ? 'text-guava-red-text'
            : 'text-guava-green'
          : 'text-[#444444]'
        const effectColor = m.active
          ? m.positive === false
            ? 'text-guava-red-text'
            : 'text-guava-green'
          : 'text-muted'
        const labelColor = m.active ? 'text-text' : 'text-muted'

        return (
          <div key={m.label} className="flex items-center gap-3 py-1.5">
            <span className={iconColor}>{m.icon}</span>
            <span className={`text-xs font-medium w-24 shrink-0 ${labelColor}`}>
              {m.label}
            </span>
            <span className={`text-xs ${effectColor}`}>
              {m.effect}
              {m.reason ? <span className="text-muted"> - {m.reason}</span> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
