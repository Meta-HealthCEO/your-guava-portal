import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import History from './History'

const mockGet = vi.fn()

vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
      {children}
    </div>
  ),
}))

const historyPayload = {
  success: true,
  history: [
    {
      forecastId: 'forecast-1',
      date: '2026-05-18T00:00:00.000Z',
      predictedRevenue: 1000,
      actualRevenue: 1200,
      variance: 200,
      variancePct: 20,
      revenueAccuracy: 83.3,
      itemAccuracy: 76,
      transactionCount: 42,
      weather: {
        temp: 16,
        condition: 'Patchy rain nearby',
        humidity: 82,
        isRain: true,
        precipMm: 3.5,
        chanceOfRain: 70,
      },
      signals: {
        isPublicHoliday: false,
        isSchoolHoliday: true,
        isPayday: false,
        loadSheddingStage: 0,
        events: [{ name: 'Local Market', impact: 'medium', impactPct: 22 }],
      },
      activeFactors: [
        { key: 'events', label: 'Events', active: true, effect: '+22%' },
        { key: 'learning', label: 'Learning correction', active: true, effect: '+8%', adjustmentPct: 8 },
      ],
      factorSummary: [
        { key: 'events', label: 'Events', effect: '+22%', adjustmentPct: 22 },
        { key: 'learning', label: 'Learning correction', effect: '+8%', adjustmentPct: 8 },
      ],
      calibration: {
        lookbackDays: 60,
        sampleSize: 8,
        overallMultiplier: 1.08,
        factorMultipliers: [
          { key: 'weather', label: 'Weather', multiplier: 0.96, sampleSize: 4, averageRatio: 0.96 },
        ],
        itemMultipliers: [
          { itemName: 'Flat White', multiplier: 1.12, sampleSize: 5, averageRatio: 1.12 },
        ],
        generatedAt: '2026-05-18T00:00:00.000Z',
      },
      trainingData: { transactionCount: 12, weeksWithSales: 4 },
    },
  ],
  meta: {
    days: 90,
    startDate: '2026-02-18',
    endDate: '2026-05-18',
    totalTradingDays: 1,
    totalRows: 1,
    generated: 1,
    pendingDays: 0,
    isPartial: false,
    backfill: {
      status: 'complete',
      pendingDays: 0,
      batchSize: 14,
    },
    overallRevenueAccuracy: 83.3,
    avgDailyRevenueAccuracy: 83.3,
    avgRevenueAccuracy: 83.3,
    totalPredictedRevenue: 1000,
    totalActualRevenue: 1200,
    variance: 200,
    variancePct: 20,
  },
}

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>
  )
}

describe('History page', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: historyPayload })
  })

  it('loads historical prediction rows with weather and factors', async () => {
    renderHistory()

    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/forecasts/history?days=90'))

    expect(screen.getByText(/Patchy rain nearby/)).toBeInTheDocument()
    expect(screen.getByText(/Local Market/)).toBeInTheDocument()
    expect(screen.getByText('Overall accuracy')).toBeInTheDocument()
    expect(screen.getByText('Daily avg 83.3%')).toBeInTheDocument()
    expect(screen.getByText('Model Learning')).toBeInTheDocument()
    expect(screen.getByText('Flat White')).toBeInTheDocument()
    expect(screen.getAllByText('83.3%').length).toBeGreaterThan(0)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('reloads when the user selects a different period', async () => {
    const user = userEvent.setup()
    renderHistory()

    await screen.findByText(/Patchy rain nearby/)
    await user.click(screen.getByRole('button', { name: '365d' }))

    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/forecasts/history?days=365'))
  })

  it('shows an empty state when there are no completed trading days', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        history: [],
        meta: {
          ...historyPayload.meta,
          totalTradingDays: 0,
          totalRows: 0,
          pendingDays: 0,
          isPartial: false,
          overallRevenueAccuracy: null,
          avgDailyRevenueAccuracy: null,
          avgRevenueAccuracy: null,
          totalPredictedRevenue: 0,
          totalActualRevenue: 0,
          variance: 0,
          variancePct: null,
        },
      },
    })

    renderHistory()

    expect(await screen.findByText('No completed trading days found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Data Health' })).toHaveAttribute('href', '/data-health')
  })

  it('shows a preparing state instead of blocking when backfill is pending', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        history: [],
        meta: {
          ...historyPayload.meta,
          totalTradingDays: 12,
          totalRows: 0,
          pendingDays: 12,
          isPartial: true,
          backfill: { status: 'started', pendingDays: 12, batchSize: 14 },
          overallRevenueAccuracy: null,
          avgDailyRevenueAccuracy: null,
          avgRevenueAccuracy: null,
          totalPredictedRevenue: 0,
          totalActualRevenue: 0,
          variance: 0,
          variancePct: null,
        },
      },
    })

    renderHistory()

    expect(await screen.findByText('Preparing history')).toBeInTheDocument()
    expect(screen.getByText(/Showing 0 of 12 completed trading days/)).toBeInTheDocument()
  })
})
