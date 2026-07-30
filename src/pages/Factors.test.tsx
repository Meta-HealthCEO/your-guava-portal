import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { AuthContext } from '@/contexts/AuthContext'
import Factors from './Factors'
import type { ForecastFactorSettings } from '@/types'
import type { ReactNode } from 'react'

vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/assets/guava-icon.png', () => ({ default: 'icon.png' }))

const mockGet = vi.fn()
const mockPut = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}))

const settings: ForecastFactorSettings = {
  history: { maxWeeks: 8, recentWeights: [0.35, 0.25, 0.2], twoWeekWeights: [0.6, 0.4] },
  weather: {
    enabled: true,
    hotTemp: 27,
    coldTemp: 18,
    hotColdDrinkPct: 30,
    hotCoffeePct: -10,
    coldCoffeePct: 15,
    coldColdDrinkPct: -20,
    rainPct: -10,
    minimumMultiplier: 0.1,
  },
  loadShedding: { enabled: true, stage1To2Pct: -8, stage3To4Pct: -22, stage5PlusPct: -40 },
  holiday: { enabled: true, publicPct: 15, schoolPct: 8, combinedPct: 20 },
  payday: { enabled: true, pct: 20 },
  events: { enabled: true, lowPct: 10, mediumPct: 20, highPct: 35 },
  stock: { safetyMarginPct: 10, maxBiasPct: 50 },
  learning: { enabled: true },
}

const entitlements = {
  plan: 'growth' as const,
  factors: [
    {
      key: 'weather',
      label: 'Weather',
      section: 'weather' as const,
      requiredPlan: 'starter' as const,
      summary: 'Temperature and rain adjust coffee and cold drink demand.',
      unlocked: true,
    },
    {
      key: 'holiday',
      label: 'Public & school holidays',
      section: 'holiday' as const,
      requiredPlan: 'starter' as const,
      summary: 'Calendar holidays adjust day-level demand.',
      unlocked: true,
    },
    {
      key: 'payday',
      label: 'Payday',
      section: 'payday' as const,
      requiredPlan: 'growth' as const,
      summary: 'Month-end payday windows lift demand.',
      unlocked: true,
    },
    {
      key: 'events',
      label: 'Local events',
      section: 'events' as const,
      requiredPlan: 'growth' as const,
      summary: 'Configured local events apply demand weights.',
      unlocked: true,
    },
    {
      key: 'loadShedding',
      label: 'Load shedding',
      section: 'loadShedding' as const,
      requiredPlan: 'growth' as const,
      summary: 'Power disruption stages reduce expected demand.',
      unlocked: true,
    },
    {
      key: 'stock',
      label: 'Stock buffer',
      section: 'stock' as const,
      requiredPlan: 'growth' as const,
      summary: 'Suggested stock includes a safety margin.',
      unlocked: true,
    },
    {
      key: 'history',
      label: 'History weights',
      section: 'history' as const,
      requiredPlan: 'pro' as const,
      summary: 'Tune how strongly recent trading weeks influence the forecast.',
      unlocked: false,
    },
    {
      key: 'learning',
      label: 'Learning correction',
      section: 'learning' as const,
      requiredPlan: 'pro' as const,
      summary: 'Past forecast errors correct future demand.',
      unlocked: false,
    },
  ],
  unlockedKeys: ['weather', 'holiday', 'payday', 'events', 'loadShedding', 'stock'],
  lockedKeys: ['history', 'learning'],
}

function renderWithAuth(ui: ReactNode) {
  const user = {
    id: 'user123',
    email: 'test@yourguava.com',
    name: 'Test Owner',
    role: 'owner' as const,
    orgId: 'org123',
    cafeIds: ['cafe123'],
    activeCafeId: 'cafe123',
  }

  return render(
    <BrowserRouter>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isOwner: true,
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          switchCafe: vi.fn(),
        }}
      >
        {ui}
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('Factors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) {
        return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      }
      if (url.includes('/cafe/list')) {
        return Promise.resolve({ data: { cafes: [] } })
      }
      if (url.includes('/forecasts/factors')) {
        return Promise.resolve({ data: { defaults: settings, settings, entitlements } })
      }
      if (url.includes('/events')) {
        if (url.includes('/events/effects')) {
          return Promise.resolve({
            data: {
              effects: [
                {
                  eventId: 'event1',
                  name: 'Saturday Market',
                  date: '2026-06-06',
                  impact: 'high',
                  expectedImpactPct: 35,
                  actualRevenue: 15000,
                  actualTransactions: 120,
                  baselineRevenue: 10000,
                  baselineTransactions: 90,
                  baselineDayCount: 6,
                  revenueImpactPct: 50,
                  transactionImpactPct: 33.3,
                  vsExpectedPct: 15,
                  confidence: 'medium',
                },
              ],
              summary: {
                eventsAnalyzed: 1,
                avgRevenueImpactPct: 50,
                aboveExpected: 1,
                belowExpected: 0,
                insufficientData: 0,
              },
            },
          })
        }
        return Promise.resolve({
          data: {
            events: [
              { _id: 'event1', name: 'Saturday Market', date: '2026-06-06', impact: 'high', recurring: false },
            ],
          },
        })
      }
      if (url.includes('/forecasts/week')) {
        return Promise.resolve({
          data: {
            forecasts: [
              {
                _id: 'forecast1',
                date: '2026-06-06',
                totalPredictedRevenue: 12000,
                items: [],
                signals: {
                  weather: { temp: 29, condition: 'Sunny', humidity: 55 },
                  loadSheddingStage: 0,
                  isPublicHoliday: false,
                  isSchoolHoliday: false,
                  isPayday: false,
                  dayOfWeek: 6,
                  events: [{ name: 'Saturday Market', impact: 'high' }],
                },
                factors: [
                  { key: 'weather', label: 'Weather', active: true, effect: '+30%', adjustmentPct: 30 },
                  { key: 'events', label: 'Events', active: true, effect: '+35%', adjustmentPct: 35 },
                ],
                calibration: {
                  lookbackDays: 60,
                  sampleSize: 7,
                  overallMultiplier: 1.08,
                  factorMultipliers: [
                    { key: 'weather', label: 'Weather', multiplier: 0.96, sampleSize: 4, averageRatio: 0.96 },
                  ],
                  itemMultipliers: [
                    { itemName: 'Flat White', multiplier: 1.12, sampleSize: 5, averageRatio: 1.12 },
                  ],
                  generatedAt: '2026-06-06T00:00:00.000Z',
                },
              },
            ],
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
    mockPut.mockResolvedValue({ data: { settings, entitlements } })
  })

  it('does not present failed live-factor requests as verified empty data', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/cafe/me')) return Promise.resolve({ data: { cafe: { name: 'Test Cafe' } } })
      if (url.includes('/cafe/list')) return Promise.resolve({ data: { cafes: [] } })
      if (url.includes('/forecasts/factors')) {
        return Promise.resolve({ data: { defaults: settings, settings, entitlements } })
      }
      if (url.includes('/events/effects')) return Promise.reject(new Error('effects unavailable'))
      if (url.includes('/events')) return Promise.resolve({ data: { events: [] } })
      if (url.includes('/forecasts/week')) return Promise.reject(new Error('forecasts unavailable'))
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    renderWithAuth(<Factors />)

    expect(await screen.findByText(/empty values below do not mean/i)).toBeInTheDocument()
    expect(screen.getByText(/live forecast factors and historical event effects/i)).toBeInTheDocument()
  })

  it('shows the live factor workspace', async () => {
    renderWithAuth(<Factors />)

    await waitFor(() => {
      expect(screen.getByText('Forecast Factors')).toBeInTheDocument()
    })

    expect(screen.getByText('Saturday Market')).toBeInTheDocument()
    expect(screen.getAllByText('Weather').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0)
    expect(screen.getByText('+50%')).toBeInTheDocument()
    expect(screen.getByText('Model Learning')).toBeInTheDocument()
    expect(screen.getByText('Pro plan required')).toBeInTheDocument()
    expect(screen.getByText('Flat White')).toBeInTheDocument()
  })

  it('saves factor rules', async () => {
    renderWithAuth(<Factors />)

    await userEvent.click(await screen.findByText('Rules'))
    await userEvent.click(screen.getByText('Save Factors'))

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/forecasts/factors', { settings })
    })
  })
})
