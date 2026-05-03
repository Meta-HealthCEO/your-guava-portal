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
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const sampleForecasts = [
  { ...mockForecast, _id: 'f1', date: '2026-03-23' },
  { ...mockForecast, _id: 'f2', date: '2026-03-24', totalPredictedRevenue: 18000 },
]

describe('WeekTrajectoryChart', () => {
  it('renders without crashing and shows title', () => {
    render(<WeekTrajectoryChart forecasts={sampleForecasts} lastWeekRevenue={[]} />)
    expect(screen.getByText('Revenue trajectory')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})
