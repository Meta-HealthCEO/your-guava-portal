import { describe, expect, it } from 'vitest'
import { isOccasionalSeller } from './forecastItems'

describe('isOccasionalSeller', () => {
  it('treats a line selling under two a day as occasional', () => {
    expect(isOccasionalSeller({ predictedQty: 1, baseQty: 1.2 })).toBe(true)
  })

  it('keeps a busy line in the plan even when its confidence is low', () => {
    expect(isOccasionalSeller({ predictedQty: 20, baseQty: 20, confidence: 'low' })).toBe(false)
  })

  it('falls back to the predicted quantity when there is no base quantity', () => {
    expect(isOccasionalSeller({ predictedQty: 1 })).toBe(true)
    expect(isOccasionalSeller({ predictedQty: 2 })).toBe(false)
  })

  it('judges the baseline, not the adjusted number, when both are present', () => {
    // A multiplier can push a 1.5-a-day line to 2 for one day; it is still occasional.
    expect(isOccasionalSeller({ predictedQty: 2, baseQty: 1.5 })).toBe(true)
  })
})
