import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { DayCard } from './DayCard'
import { mockForecast } from '@/test/mocks/api'

describe('DayCard', () => {
  it('renders day revenue and calls onClick', () => {
    const handleClick = vi.fn()
    // Use a fixed future date so the label is a weekday name, not "Today"
    const forecast = { ...mockForecast, _id: 'f1', date: '2026-03-30', totalPredictedRevenue: 20100 }

    render(<DayCard forecast={forecast} weekAvg={20000} mode="plan" onClick={handleClick} />)

    // Revenue is displayed
    expect(screen.getByText((t) => t.includes('20') && t.includes('100'))).toBeInTheDocument()

    // Clicking the card fires the callback
    const card = screen.getByText((t) => t.includes('20') && t.includes('100')).closest('[class*="rounded"]')
    fireEvent.click(card!)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('shows weather chip', () => {
    render(
      <DayCard
        forecast={{ ...mockForecast, _id: 'f1', date: '2026-04-01' }}
        weekAvg={20000}
        mode="plan"
        onClick={() => {}}
      />
    )
    // Weather is always shown; mockForecast has temp 24, condition Sunny
    expect(screen.getByText(/24°C/)).toBeInTheDocument()
  })

  it('review mode shows actual qty and delta when actuals are present', () => {
    const forecastWithActuals = {
      ...mockForecast,
      _id: 'f-past',
      date: '2026-03-20',
      accuracy: 90,
      items: [
        { itemName: 'Flat White (Blend)', predictedQty: 30, actualQty: 24 },
        { itemName: 'Long White (Blend)', predictedQty: 31, actualQty: 36 },
        { itemName: 'Brownie', predictedQty: 3, actualQty: 3 },
      ],
    }

    render(
      <DayCard
        forecast={forecastWithActuals}
        weekAvg={20000}
        mode="review"
        onClick={() => {}}
      />
    )

    // Accuracy badge should appear
    expect(screen.getByText(/Accuracy: 90%/)).toBeInTheDocument()

    // Should show actual values
    expect(screen.getByText(/actual: 24/)).toBeInTheDocument()
    expect(screen.getByText(/actual: 36/)).toBeInTheDocument()

    // Should show predicted labels
    expect(screen.getAllByText(/pred: \d+/).length).toBeGreaterThan(0)

    // Should show a delta (negative for Flat White: 24 vs 30 → -20%)
    expect(screen.getByText(/-20%/)).toBeInTheDocument()
  })
})
