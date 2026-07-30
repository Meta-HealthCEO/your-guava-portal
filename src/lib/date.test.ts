import { describe, expect, it } from 'vitest'
import { addLocalDays, getLocalMonthBounds, parseDateOnly, toLocalDateOnly } from './date'

describe('date-only helpers', () => {
  it('formats local calendar dates without a UTC conversion', () => {
    const localMidnight = new Date(2026, 6, 30, 0, 0, 0)
    expect(toLocalDateOnly(localMidnight)).toBe('2026-07-30')
  })

  it('adds days using calendar arithmetic', () => {
    expect(toLocalDateOnly(addLocalDays(new Date(2026, 0, 1, 0), -1))).toBe('2025-12-31')
  })

  it('returns correct month boundaries and parses at local noon', () => {
    expect(getLocalMonthBounds(new Date(2026, 1, 15))).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    })
    expect(parseDateOnly('2026-07-30').getHours()).toBe(12)
  })
})
