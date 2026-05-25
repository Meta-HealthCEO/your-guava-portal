import { Cloud, Zap, Calendar, Banknote, Megaphone, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Forecast, ForecastFactor } from '@/types'

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

function computeFallbackModifiers(signals: Forecast['signals']): Modifier[] {
  const { weather, loadSheddingStage, isPublicHoliday, isSchoolHoliday, isPayday, events } = signals

  let weatherEffect = 'no effect'
  let weatherActive = false
  let weatherPositive: boolean | null = null
  if (weather.condition?.toLowerCase().includes('rain')) {
    weatherEffect = '-10% across the board'
    weatherActive = true
    weatherPositive = false
  } else if (weather.temp > 27) {
    weatherEffect = '+30% cold drinks, -10% coffee'
    weatherActive = true
    weatherPositive = true
  } else if (weather.temp < 18) {
    weatherEffect = '+15% coffee, -20% cold drinks'
    weatherActive = true
    weatherPositive = true
  }

  let loadEffect = 'no effect'
  let loadActive = false
  if (loadSheddingStage >= 5) {
    loadEffect = '-40%'
    loadActive = true
  } else if (loadSheddingStage >= 3) {
    loadEffect = '-22%'
    loadActive = true
  } else if (loadSheddingStage >= 1) {
    loadEffect = '-8%'
    loadActive = true
  }

  let holidayEffect = 'no effect'
  let holidayActive = false
  let holidayPositive: boolean | null = null
  if (isPublicHoliday && isSchoolHoliday) {
    holidayEffect = '+20%'
    holidayActive = true
    holidayPositive = true
  } else if (isPublicHoliday) {
    holidayEffect = '+15%'
    holidayActive = true
    holidayPositive = true
  } else if (isSchoolHoliday) {
    holidayEffect = '+8%'
    holidayActive = true
    holidayPositive = true
  }

  const evList = events ?? []
  let eventEffect = 'no effect'
  let eventActive = false
  if (evList.length > 0) {
    const impacts = evList.map((e) => e.impactPct ?? (e.impact === 'high' ? 35 : e.impact === 'medium' ? 20 : 10))
    const maxImpact = impacts.sort((a, b) => Math.abs(b) - Math.abs(a))[0]
    eventEffect = `${maxImpact > 0 ? '+' : ''}${maxImpact}%`
    eventActive = maxImpact !== 0
  }

  return [
    {
      icon: ICONS.weather,
      label: 'Weather',
      effect: weatherEffect,
      active: weatherActive,
      positive: weatherPositive,
    },
    {
      icon: ICONS.loadShedding,
      label: 'Load shedding',
      effect: loadEffect,
      active: loadActive,
      positive: loadActive ? false : null,
    },
    {
      icon: ICONS.holiday,
      label: 'Holiday',
      effect: holidayEffect,
      active: holidayActive,
      positive: holidayPositive,
    },
    {
      icon: ICONS.payday,
      label: 'Payday',
      effect: isPayday ? '+20%' : 'no effect',
      active: isPayday,
      positive: isPayday ? true : null,
    },
    {
      icon: ICONS.events,
      label: 'Events',
      effect: eventEffect,
      active: eventActive,
      positive: eventActive && !eventEffect.startsWith('-') ? true : eventActive ? false : null,
    },
  ]
}

interface Props {
  signals: Forecast['signals']
  factors?: ForecastFactor[]
}

export function ModifierBreakdown({ signals, factors }: Props) {
  const modifiers = factors && factors.length > 0
    ? factors.map(modifierFromAppliedFactor)
    : computeFallbackModifiers(signals)

  return (
    <div className="space-y-2">
      {modifiers.map((m) => {
        const iconColor = m.active
          ? m.positive === false
            ? 'text-guava-red'
            : 'text-guava-green'
          : 'text-[#444444]'
        const effectColor = m.active
          ? m.positive === false
            ? 'text-guava-red'
            : 'text-guava-green'
          : 'text-[#555555]'
        const labelColor = m.active ? 'text-text' : 'text-[#555555]'

        return (
          <div key={m.label} className="flex items-center gap-3 py-1.5">
            <span className={iconColor}>{m.icon}</span>
            <span className={`text-xs font-medium w-24 shrink-0 ${labelColor}`}>
              {m.label}
            </span>
            <span className={`text-xs ${effectColor}`}>
              {m.effect}
              {m.reason ? <span className="text-[#555555]"> - {m.reason}</span> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
