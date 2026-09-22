import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekHeader } from './WeekHeader'

describe('WeekHeader', () => {
  it('withholds the verdict until enough days have been matched', () => {
    render(<WeekHeader weekTotal={42100} peakDay={null} accuracy={88} matchedDays={1} />)

    expect(screen.getByText('88%')).toBeInTheDocument()
    // One lucky day is not a track record, and this is the number an owner uses
    // to decide whether to trust the whole product.
    expect(screen.queryByText('Strong')).not.toBeInTheDocument()
    expect(screen.getByText(/From 1 matched day — too few for a verdict yet/i)).toBeInTheDocument()
  })

  it('states the sample size once there is one worth stating', () => {
    render(<WeekHeader weekTotal={42100} peakDay={null} accuracy={88} matchedDays={12} />)

    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText('From 12 matched days')).toBeInTheDocument()
  })

  it('grades on the same band the day cards use', () => {
    // 82% is amber under DayCard's old >=85 rule and green under WeekHeader's
    // >=80 rule; one screenful used to show both readings of one number.
    render(<WeekHeader weekTotal={1000} peakDay={null} accuracy={82} matchedDays={10} />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('says nothing about a sample it was not given', () => {
    render(<WeekHeader weekTotal={1000} peakDay={null} accuracy={88} />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.queryByText(/matched day/i)).not.toBeInTheDocument()
  })
})
