import { Cloud, Zap, Calendar, Banknote, Megaphone } from 'lucide-react'
import type { Forecast } from '@/types'

interface Modifier {
  icon: React.ReactNode
  label: string
  effect: string
  active: boolean
  positive: boolean | null // null = neutral / no effect
}

function computeModifiers(signals: Forecast['signals']): Modifier[] {
  const { weather, loadSheddingStage, isPublicHoliday, isSchoolHoliday, isPayday, events } = signals

  // Weather modifier
  let weatherEffect = 'no effect'
  let weatherActive = false
  let weatherPositive: boolean | null = null
  if (weather.condition?.toLowerCase().includes('rain')) {
    weatherEffect = '−10% across the board'
    weatherActive = true
    weatherPositive = false
  } else if (weather.temp > 27) {
    weatherEffect = '+30% cold drinks, −10% coffee'
    weatherActive = true
    weatherPositive = true
  } else if (weather.temp < 18) {
    weatherEffect = '+15% coffee, −20% cold drinks'
    weatherActive = true
    weatherPositive = true
  }

  // Load shedding modifier
  let loadEffect = 'no effect'
  let loadActive = false
  if (loadSheddingStage >= 5) {
    loadEffect = '−40%'
    loadActive = true
  } else if (loadSheddingStage >= 3) {
    loadEffect = '−22%'
    loadActive = true
  } else if (loadSheddingStage >= 1) {
    loadEffect = '−8%'
    loadActive = true
  }

  // Holiday modifier
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

  // Payday modifier
  const paydayEffect = isPayday ? '+20%' : 'no effect'

  // Events modifier — max impact
  const evList = events ?? []
  let eventEffect = 'no effect'
  let eventActive = false
  if (evList.length > 0) {
    const impacts = evList.map((e) => {
      if (e.impact === 'high') return 35
      if (e.impact === 'medium') return 20
      return 10
    })
    const maxImpact = Math.max(...impacts)
    eventEffect = `+${maxImpact}%`
    eventActive = true
  }

  return [
    {
      icon: <Cloud className="w-3.5 h-3.5" />,
      label: 'Weather',
      effect: weatherEffect,
      active: weatherActive,
      positive: weatherPositive,
    },
    {
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Load shedding',
      effect: loadEffect,
      active: loadActive,
      positive: loadActive ? false : null,
    },
    {
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: 'Holiday',
      effect: holidayEffect,
      active: holidayActive,
      positive: holidayPositive,
    },
    {
      icon: <Banknote className="w-3.5 h-3.5" />,
      label: 'Payday',
      effect: paydayEffect,
      active: isPayday,
      positive: isPayday ? true : null,
    },
    {
      icon: <Megaphone className="w-3.5 h-3.5" />,
      label: 'Events',
      effect: eventEffect,
      active: eventActive,
      positive: eventActive ? true : null,
    },
  ]
}

interface Props {
  signals: Forecast['signals']
}

export function ModifierBreakdown({ signals }: Props) {
  const modifiers = computeModifiers(signals)

  return (
    <div className="space-y-2">
      {modifiers.map((m) => {
        const iconColor = m.active
          ? m.positive === false
            ? 'text-[#D43D3D]'
            : 'text-[#4DA63B]'
          : 'text-[#444444]'
        const effectColor = m.active
          ? m.positive === false
            ? 'text-[#D43D3D]'
            : 'text-[#4DA63B]'
          : 'text-[#555555]'
        const labelColor = m.active ? 'text-[#F0F0F0]' : 'text-[#555555]'

        return (
          <div key={m.label} className="flex items-center gap-3 py-1.5">
            <span className={iconColor}>{m.icon}</span>
            <span className={`text-xs font-medium w-24 flex-shrink-0 ${labelColor}`}>
              {m.label}
            </span>
            <span className={`text-xs ${effectColor}`}>{m.effect}</span>
          </div>
        )
      })}
    </div>
  )
}
