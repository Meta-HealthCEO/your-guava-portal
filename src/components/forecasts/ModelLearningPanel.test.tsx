import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelLearningPanel } from './ModelLearningPanel'
import type { ForecastFactorEntitlements, ForecastFactorSettings } from '@/types'

const settings: ForecastFactorSettings = {
  history: { maxWeeks: 8, recentWeights: [], twoWeekWeights: [] },
  weather: {
    enabled: true, hotTemp: 27, coldTemp: 18, hotColdDrinkPct: 30, hotCoffeePct: -10,
    coldCoffeePct: 15, coldColdDrinkPct: -20, rainPct: -10, minimumMultiplier: 0.1,
  },
  loadShedding: { enabled: true, stage1To2Pct: -8, stage3To4Pct: -22, stage5PlusPct: -40 },
  holiday: { enabled: true, publicPct: 15, schoolPct: 8, combinedPct: 20 },
  payday: { enabled: true, pct: 20 },
  events: { enabled: true, lowPct: 10, mediumPct: 20, highPct: 35 },
  stock: { safetyMarginPct: 10, maxBiasPct: 50 },
  learning: { enabled: true },
}

const lockedEntitlements: ForecastFactorEntitlements = {
  plan: 'starter',
  factors: [
    { key: 'learning', label: 'Learning correction', section: 'learning', requiredPlan: 'pro', summary: '', unlocked: false },
  ],
  unlockedKeys: [],
  lockedKeys: ['learning'],
}

describe('ModelLearningPanel', () => {
  it('does not report a failed request as a verdict on the cafe', () => {
    render(<ModelLearningPanel sources={[]} settings={settings} unavailable />)

    expect(screen.getByText('Status unavailable')).toBeInTheDocument()
    expect(screen.getByText(/forecast service could not be reached/i)).toBeInTheDocument()
    expect(screen.queryByText('Waiting for history')).not.toBeInTheDocument()
    expect(screen.queryByText(/at least 3 matched item outcomes/i)).not.toBeInTheDocument()
  })

  it('still says the cafe is waiting when the request genuinely returned nothing', () => {
    render(<ModelLearningPanel sources={[]} settings={settings} />)

    expect(screen.getByText('Waiting for history')).toBeInTheDocument()
    expect(screen.getByText(/at least 3 matched item outcomes/i)).toBeInTheDocument()
  })

  it('reports a plan lock ahead of any history verdict', () => {
    render(<ModelLearningPanel sources={[]} settings={settings} entitlements={lockedEntitlements} />)

    expect(screen.getByText('Pro plan required')).toBeInTheDocument()
  })

  it('reports learning switched off in factor rules', () => {
    render(
      <ModelLearningPanel
        sources={[]}
        settings={{ ...settings, learning: { enabled: false } }}
      />
    )

    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText(/disabled in factor rules/i)).toBeInTheDocument()
  })
})
