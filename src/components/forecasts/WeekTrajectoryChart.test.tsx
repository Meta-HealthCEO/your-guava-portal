import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { WeekTrajectoryChart } from './WeekTrajectoryChart'
import { mockForecast } from '@/test/mocks/api'

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const futureSample = [
  { ...mockForecast, _id: 'f1', date: '2026-05-04' },
  { ...mockForecast, _id: 'f2', date: '2026-05-05', totalPredictedRevenue: 18000 },
]

const pastSample = [
  { ...mockForecast, _id: 'p1', date: '2026-04-27', accuracy: 88 },
  { ...mockForecast, _id: 'p2', date: '2026-04-28', accuracy: 75, totalPredictedRevenue: 19000 },
]

describe('WeekTrajectoryChart', () => {
  it('renders without crashing and shows title', () => {
    render(<WeekTrajectoryChart futureForecasts={futureSample} pastForecasts={[]} />)
    expect(screen.getByText('Revenue trajectory')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders with both past and future forecasts', () => {
    render(<WeekTrajectoryChart futureForecasts={futureSample} pastForecasts={pastSample} />)
    expect(screen.getByText('Revenue trajectory')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})
