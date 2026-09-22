import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { SetupChecklistCard, SETUP_DISMISSED_KEY, type SetupItem } from './SetupChecklistCard'

const location: SetupItem = {
  id: 'location',
  label: "Set your cafe's location so weather can adjust forecasts",
  href: '/settings?section=general&edit=cafe',
}
const hours: SetupItem = {
  id: 'hours',
  label: 'Sunday is set to closed but you had sales — check trading hours',
  href: '/settings?section=general',
}

describe('SetupChecklistCard', () => {
  beforeEach(() => localStorage.clear())

  it('lists what is still outstanding, each with somewhere to go', () => {
    render(<SetupChecklistCard items={[location, hours]} />)

    expect(screen.getByRole('link', { name: /set your cafe's location/i })).toHaveAttribute(
      'href',
      '/settings?section=general&edit=cafe'
    )
    expect(screen.getByRole('link', { name: /check trading hours/i })).toHaveAttribute(
      'href',
      '/settings?section=general'
    )
  })

  it('renders nothing once there is nothing outstanding', () => {
    const { container } = render(<SetupChecklistCard items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays dismissed', () => {
    const { unmount } = render(<SetupChecklistCard items={[location]} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('link', { name: /set your cafe's location/i })).toBeNull()

    unmount()
    render(<SetupChecklistCard items={[location]} />)
    expect(screen.queryByRole('link', { name: /set your cafe's location/i })).toBeNull()
  })

  it('comes back when something NEW needs doing', () => {
    // Dismissing "I know about the location" must not silence a contradiction
    // discovered a fortnight later by an upload.
    localStorage.setItem(SETUP_DISMISSED_KEY, JSON.stringify(['location']))

    render(<SetupChecklistCard items={[location, hours]} />)

    expect(screen.getByRole('link', { name: /check trading hours/i })).toBeInTheDocument()
    // The one they dismissed stays gone.
    expect(screen.queryByRole('link', { name: /set your cafe's location/i })).toBeNull()
  })

  it('survives storage being unavailable', () => {
    // Private windows and blocked site data throw on access. A setup hint is
    // not worth taking the dashboard down for.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    render(<SetupChecklistCard items={[location]} />)
    expect(screen.getByRole('link', { name: /set your cafe's location/i })).toBeInTheDocument()

    spy.mockRestore()
  })
})
