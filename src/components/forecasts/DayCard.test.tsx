import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { DayCard } from './DayCard'
import { mockForecast } from '@/test/mocks/api'

describe('DayCard', () => {
  it('renders day revenue and calls onClick', () => {
    const handleClick = vi.fn()
    // Use a fixed future date so the label is a weekday name, not "Today"
    const forecast = { ...mockForecast, _id: 'f1', date: '2026-03-30', totalPredictedRevenue: 20100 }

    render(<DayCard forecast={forecast} weekAvg={20000} onClick={handleClick} />)

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
        onClick={() => {}}
      />
    )
    // Weather is always shown; mockForecast has temp 24, condition Sunny
    expect(screen.getByText(/24°C/)).toBeInTheDocument()
  })
})
